/**
 * Fetcher/parser for VCF files.
 * This makes very little effort to parse out details from VCF entries. It just
 * extracts CONTIG, POSITION, REF and ALT.
 *
 * @flow
 */
'use strict';

import type AbstractFile from '../AbstractFile';
import Q from 'q';
import _ from 'underscore';
import ContigInterval from '../ContigInterval';
import {Call, Variant, VariantContext} from "./variant";

import {TabixIndexedFile} from '@gmod/tabix';
import {RemoteFile as TabixLibRemoteFile} from 'generic-filehandle';

// This is a minimally-parsed line for facilitating binary search.
type LocusLine = {
  contig: string;
  position: number;
  line: string;
}

function extractSamples(header: string[]): string[] {

  var line = _.filter(header, h => h.startsWith("#CHROM"))[0].split('\t');

  // drop first 8 titles. See vcf header specification 1.3: https://samtools.github.io/hts-specs/VCFv4.2.pdf
  var samples = line.splice(9);

  return samples;
}


function extractLocusLine(vcfLine: string): LocusLine {
  var tab1 = vcfLine.indexOf('\t'),
    tab2 = vcfLine.indexOf('\t', tab1 + 1);

  return {
    contig: vcfLine.slice(0, tab1),
    position: Number(vcfLine.slice(tab1 + 1, tab2)),
    line: vcfLine
  };
}


function extractVariantContext(samples: string[], vcfLine: string): VariantContext {
  var parts = vcfLine.split('\t');
  var maxFrequency = null;
  var minFrequency = null;
  var calls = [];

  if (parts.length >= 7) {
    var params = parts[7].split(';'); // process INFO field
    for (var i = 0; i < params.length; i++) {
      var param = params[i];
      if (param.startsWith("AF=")) {
        maxFrequency = 0.0;
        minFrequency = 1.0;
        var frequenciesStrings = param.substr(3).split(",");
        for (var j = 0; j < frequenciesStrings.length; j++) {
          var currentFrequency = parseFloat(frequenciesStrings[j]);
          maxFrequency = Math.max(maxFrequency, currentFrequency);
          minFrequency = Math.min(minFrequency, currentFrequency);
        }
      }
    }

    // process genotype information for each sample
    if (parts.length > 9) {
      var sample_i = 0; // keeps track of which sample we are processing
      for (i = 9; i < parts.length; i++) {
        var genotype = parts[i].split(':')[0].split("/").map(i => parseInt(i));
        // TODO is it ever not 2?
        if (genotype.length == 2) {
          if (parseInt(genotype[0]) == 1 || parseInt(genotype[1]) == 1) {
            // TODO do you have to overwrite with concat?
            var call = new Call(samples[sample_i], genotype,
              samples[sample_i], "True"); // currently not doing anything with phasing
            calls = calls.concat(call);
          }
        }
        sample_i++;
      }
    }
  }
  var contig = parts[0];
  var position = Number(parts[1]);

  return new VariantContext(new Variant({
    contig: contig,
    position: position,
    id: parts[2],
    ref: parts[3],
    alt: parts[4],
    majorFrequency: maxFrequency,
    minorFrequency: minFrequency,
    vcfLine,
  }), calls);
}


function compareLocusLine(a: LocusLine, b: LocusLine): number {
  // Sort lexicographically by contig, then numerically by position.
  if (a.contig < b.contig) {
    return -1;
  } else if (a.contig > b.contig) {
    return +1;
  } else {
    return a.position - b.position;
  }
}


// (based on underscore source)
function lowestIndex<T>(haystack: T[], needle: T, compare: (a: T, b: T)=>number): number {
  var low = 0,
    high = haystack.length;
  while (low < high) {
    var mid = Math.floor((low + high) / 2),
      c = compare(haystack[mid], needle);
    if (c < 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}


class ImmediateVcfFile {
  lines: LocusLine[];
  contigMap: { [key: string]: string };  // canonical map
  samples: string[];

  constructor(samples: string[], lines: LocusLine[]) {
    this.samples = samples;
    this.lines = lines;
    this.contigMap = this.extractContigs();
  }

  extractContigs(): { [key: string]: string } {
    var contigs = [],
      lastContig = '';
    for (var i = 0; i < this.lines.length; i++) {
      var line = this.lines[i];
      if (line.contig != lastContig) {
        contigs.push(line.contig);
      }
    }

    var contigMap = {};
    contigs.forEach(contig => {
      if (contig.slice(0, 3) == 'chr') {
        contigMap[contig.slice(4)] = contig;
      } else {
        contigMap['chr' + contig] = contig;
      }
      contigMap[contig] = contig;
    });
    return contigMap;
  }

  getFeaturesInRange(range: ContigInterval<string>): VariantContext[] {
    var lines = this.lines;
    var contig = this.contigMap[range.contig];
    if (!contig) {
      return [];
    }

    var startLocus = {
        contig: contig,
        position: range.start(),
        line: ''
      },
      endLocus = {
        contig: contig,
        position: range.stop(),
        line: ''
      };
    var startIndex = lowestIndex(lines, startLocus, compareLocusLine);

    var result: LocusLine[] = [];

    for (var i = startIndex; i < lines.length; i++) {
      if (compareLocusLine(lines[i], endLocus) > 0) {
        break;
      }
      result.push(lines[i]);
    }

    return result.map(line => extractVariantContext(this.samples, line.line));
  }
}


class VcfFile {
  remoteFile: AbstractFile;
  immediate: Q.Promise<ImmediateVcfFile>;

  constructor(remoteFile: AbstractFile) {
    this.remoteFile = remoteFile;

    this.immediate = this.remoteFile.getAllString().then(txt => {
      // Running this on a 12MB string takes ~80ms on my 2014 Macbook Pro
      var txtLines = txt.split('\n');
      var lines = txtLines
        .filter(line => (line.length && line[0] != '#'))
        .map(extractLocusLine);

      var header = txtLines.filter(line => (line.length && line[0] == '#'));

      var samples = extractSamples(header);

      return [samples, lines];
    }).then(results => {
      var samples = results[0];
      var lines = results[1];
      // Sorting this structure from the 12MB VCF file takes ~60ms
      lines.sort(compareLocusLine);
      return new ImmediateVcfFile(samples, lines);
    });
    this.immediate.done();
  }

  getCallNames(): Q.Promise<string[]> {
    return this.immediate.then(immediate => {
      return immediate.samples;
    });
  }

  getFeaturesInRange(range: ContigInterval<string>): Q.Promise<VariantContext[]> {
    return this.immediate.then(immediate => {
      return immediate.getFeaturesInRange(range);
    });
  }
}

class VcfWithTabixFile {
  remoteTbiIndexed: TabixIndexedFile;


  constructor(vcfUrl: string, vcfTabixUrl: string) {
    this.remoteTbiIndexed = new TabixIndexedFile({
      filehandle: new TabixLibRemoteFile(vcfUrl),
      tbiFilehandle: new TabixLibRemoteFile(vcfTabixUrl)
    });
  }

  getCallNames(): Q.Promise<string[]> {
    return Q.when(this.remoteTbiIndexed.getHeader().then(function (header) {
      return extractSamples(header.split("\n"));
    }));
  }

  getFeaturesInRange(range: ContigInterval<string>): Q.Promise<VariantContext[]> {
    var remoteTbiIndexed = this.remoteTbiIndexed;
    var samples;
    const variants = [];
    return Q.when(this.getCallNames().then(function (result) {
      samples = result;
      var promises = [remoteTbiIndexed.getLines(range.contig, range.start(), range.stop(),
        function (line) {
          variants.push(extractVariantContext(samples, line));
        })];
      if (range.contig.slice(0, 3) === 'chr') {
        promises.push(remoteTbiIndexed.getLines(range.contig.slice(3), range.start(), range.stop(),
          function (line) {
            variants.push(extractVariantContext(samples, line));
          }));
      }
      return Q.all(promises);
    }).then(function () {
      return variants;
    }));
  }
}

module.exports = {
  VcfFile,
  VcfWithTabixFile
};

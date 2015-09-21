/**
 * Fetcher/parser for VCF files.
 * This makes very little effort to parse out details from VCF entries. It just
 * extracts CONTIG, POSITION, REF and ALT.
 *
 * @flow
 */
'use strict';

import type * as ContigInterval from './ContigInterval';
import type * as RemoteFile from './RemoteFile';
import type * as Q from 'q';

export type Variant = {
  contig: string;
  position: number;
  ref: string;
  alt: string;
  vcfLine: string;
}

// This is a minimally-parsed line for facilitating binary search.
type LocusLine = {
  contig: string;
  position: number;
  line: string;
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


function extractVariant(vcfLine: string): Variant {
  var parts = vcfLine.split('\t');

  return {
    contig: parts[0],
    position: Number(parts[1]),
    ref: parts[3],
    alt: parts[4],
    vcfLine
  };
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
  contigMap: {[key:string]:string};  // canonical map

  constructor(lines: LocusLine[]) {
    this.lines = lines;
    this.contigMap = this.extractContigs();
  }

  extractContigs(): {[key:string]:string} {
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

  getFeaturesInRange(range: ContigInterval<string>): Variant[] {
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

    return result.map(line => extractVariant(line.line));
  }
}


class VcfFile {
  remoteFile: RemoteFile;
  immediate: Q.Promise<ImmediateVcfFile>;

  constructor(remoteFile: RemoteFile) {
    this.remoteFile = remoteFile;

    this.immediate = this.remoteFile.getAllString().then(txt => {
      // Running this on a 12MB string takes ~80ms on my 2014 Macbook Pro
      var lines = txt.split('\n')
                     .filter(line => (line.length && line[0] != '#'))
                     .map(extractLocusLine);
      return lines;
    }).then(lines => {
      // Sorting this structure from the 12MB VCF file takes ~60ms
      lines.sort(compareLocusLine);
      return new ImmediateVcfFile(lines);
    });
    this.immediate.done();
  }

  getFeaturesInRange(range: ContigInterval<string>): Q.Promise<Variant[]> {
    return this.immediate.then(immediate => {
      return immediate.getFeaturesInRange(range);
    });
  }
}

module.exports = VcfFile;

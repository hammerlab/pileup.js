/**
 * Fetcher/parser for VCF files.
 * This makes very little effort to parse out details from VCF entries. It just
 * extracts CONTIG, POSITION, REF and ALT.
 *
 * @flow
 */
'use strict';

import type AbstractFile from '../AbstractFile';
import type Q from 'q';
import ContigInterval from '../ContigInterval';

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
  var maxFrequency = null;
  var minFrequency = null;
  if (parts.length>=7){
    var params = parts[7].split(';');
    for (var i=0;i<params.length;i++) {
      var param = params[i];
      if (param.startsWith("AF=")) {
        maxFrequency = 0.0;
        minFrequency = 1.0;
        var frequenciesStrings = param.substr(3).split(",");
        for (var j=0;j<frequenciesStrings.length;j++) {
          var currentFrequency = parseFloat(frequenciesStrings[j]);
          maxFrequency = Math.max(maxFrequency, currentFrequency);
          minFrequency = Math.min(minFrequency, currentFrequency);
        }
      }
    }
  }
  var contig = parts[0];
  var position = Number(parts[1]);

  return new Variant({
    contig: contig,
    position: position,
    id: parts[2],
    ref: parts[3],
    alt: parts[4],
    majorFrequency: maxFrequency,
    minorFrequency: minFrequency,
    vcfLine,
  });
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
  remoteFile: AbstractFile;
  immediate: Q.Promise<ImmediateVcfFile>;

  constructor(remoteFile: AbstractFile) {
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

class Variant {
  contig: string;
  position: number;
  ref: string;
  alt: string;
  id: string;
  //this is the bigest allel frequency for single vcf entry
  //single vcf entry might contain more than one variant like the example below
  //20 1110696 rs6040355 A G,T 67 PASS NS=2;DP=10;AF=0.333,0.667;AA=T;DB
  majorFrequency: ?number;
  //this is the smallest allel frequency for single vcf entry
  minorFrequency: ?number;
  vcfLine: string;


  constructor(variant: Object) {
   this.contig = variant.contig;
   this.position = variant.position;
   this.ref = variant.ref;
   this.alt = variant.alt;
   this.id = variant.id;
   this.majorFrequency = variant.majorFrequency;
   this.minorFrequency = variant.minorFrequency;
   this.vcfLine = variant.vcfLine;
  }

  static fromGA4GH(ga4ghVariant: Object): Variant {
   return new Variant(
    {
     contig: ga4ghVariant.referenceName,
     position: ga4ghVariant.start,
     id: ga4ghVariant.id,
     ref: ga4ghVariant.referenceBases,
     alt: ga4ghVariant.alternateBases,
     majorFrequency: 0,
     minorFrequency: 0, // TODO extract these
     vcfLine: "" // TODO
   });
  }

  intersects(range: ContigInterval<string>): boolean {
    return intersects(this, range);
  }

}

function intersects(variant: Variant, range: ContigInterval<string>): boolean {
  return range.intersects(new ContigInterval(variant.contig, variant.position, variant.position + 1));
}

module.exports = {
  VcfFile,
  Variant
};

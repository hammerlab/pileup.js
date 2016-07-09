
import _ from 'underscore';

import ContigInterval from '../ContigInterval';
import utils from '../utils';

// Generate the reverse map from contig ID --> contig name.
function reverseContigMap(contigMap: {[key:string]: number}): Array<string> {
  var ary = [];
  _.each(contigMap, (index, name) => {
    ary[index] = name;
  });
  return ary;
}

class ImmediateBigBedWig {
  remoteFile: RemoteFile;
  header: Object;
  cirTree: Object;
  contigMap: {[key:string]: number};
  chrIdToContig: string[];

  constructor(remoteFile, header, cirTree, contigMap: {[key:string]: number}) {
    this.remoteFile = remoteFile;
    this.header = header;
    this.cirTree = cirTree;
    this.contigMap = contigMap;
    this.chrIdToContig = reverseContigMap(contigMap);
  }

  // Map contig name to contig ID. Leading "chr" is optional. Throws on failure.
  _getContigId(contig: string): number {
    if (contig in this.contigMap) return this.contigMap[contig];
    var chr = 'chr' + contig;
    if (chr in this.contigMap) return this.contigMap[chr];
    throw `Invalid contig ${contig}`;
  }

  _getChrIdInterval(range: ContigInterval<string>): ContigInterval<number> {
    return new ContigInterval(
      this._getContigId(range.contig), range.start(), range.stop());
  }

  _getContigInterval(range: ContigInterval<number>): ContigInterval<string> {
    return new ContigInterval(
      this.chrIdToContig[range.contig], range.start(), range.stop());
  }

  // Bed entries have a chromosome ID. This converts that to a contig string.
  _attachContigToBedRows(beds: ChrIdBedRow[]): BedRow[] {
    return beds.map(bed => ({
      contig: this.chrIdToContig[bed.chrId],
      start: bed.start,
      stop: bed.stop,
      rest: bed.rest
    }));
  }

  // Find all blocks containing features which intersect with contigRange.
  _findOverlappingBlocks(range: ContigInterval<number>) {
    // Do a recursive search through the index tree
    var matchingBlocks = [];
    var tupleRange = [[range.contig, range.start()],
      [range.contig, range.stop()]];
    var find = function(node) {
      if (node.contents) {
        node.contents.forEach(find);
      } else {
        var nodeRange = [[node.startChromIx, node.startBase],
          [node.endChromIx, node.endBase]];
        if (utils.tupleRangeOverlaps(nodeRange, tupleRange)) {
          matchingBlocks.push(node);
        }
      }
    };
    find(this.cirTree.blocks);

    return matchingBlocks;
  }
}

module.exports = ImmediateBigBedWig;
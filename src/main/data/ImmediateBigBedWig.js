
import _ from 'underscore';

import ContigInterval from '../ContigInterval';

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
  zoomIndices: Array<Object>;
  zoomBases: Array<number>;
  zoomIndexMap: map<number, Object>;
  isCompressed: boolean;
  blockCache: map<number, Object>;

  constructor(remoteFile, header, cirTree, contigMap: {[key:string]: number}, zoomIndices: Array<Object>) {
    this.remoteFile = remoteFile;
    this.header = header;
    this.cirTree = cirTree;
    this.contigMap = contigMap;
    this.chrIdToContig = reverseContigMap(contigMap);
    this.zoomIndices = zoomIndices || [];
    this.zoomBases = [1];
    this.zoomIndexMap = {};
    this.zoomIndices.forEach(zoomIndex => {
      this.zoomBases.push(zoomIndex.reductionLevel);
      this.zoomIndexMap[zoomIndex.reductionLevel] = zoomIndex;
    });
    this.isCompressed = (this.header.uncompressBufSize > 0);
    this.blockCache = {};
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
}

module.exports = ImmediateBigBedWig;
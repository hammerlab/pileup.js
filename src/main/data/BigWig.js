/**
 * @flow
 */
'use strict';

import Q from 'q';

import Interval from '../Interval';
import ContigInterval from '../ContigInterval';
import BigBedWig from './BigBedWig';
import {BigWigTypeSet} from './formats/bbi';
import utils from '../utils';

// type WigBlock = {
//   chrId: number;
//   start: number;
//   end: number;
//   step: number;
//   span: number;
//   tpe: number;
//   count: number;
// }

export type Bucket = {
  chrId: string;
  start: number;
  end: number;
  value: number;
}


// This (internal) version of the BigBed class has no promises for headers,
// only immediate data. This greatly simplifies writing methods on it.
class BigWig extends BigBedWig {
  zoomIndices: Array<Object>;
  zoomBases: Array<number>;
  zoomIndexMap: map<number, Object>;

  static load(url: string): BigWig {
    var { remoteFile, immediate } = BigBedWig.load(url, BigWigTypeSet);
    immediate
      .then(([ header, cirTree, contigMap ]) => {
        var zoomIndices =
          header.then(header => {
            header.zoomHeaders.map((zoomHeader, idx) => {
              var byteRangeStart = zoomHeader.indexOffset;
              var byteRangeEnd =
                  (idx + 1 < header.zoomLevels.length) ?
                    header.zoomLevels[idx + 1].dataOffset :
                    remoteFile.getSize()
                ;

              return remoteFile.getBytes(byteRangeStart, byteRangeEnd - byteRangeStart);
            });
          });

        return [ header, cirTree, contigMap, zoomIndices ];
      }).then(([ header, cirTree, contigMap, zoomIndices ]) => {
        var cm: {[key:string]: number} = contigMap;
        return new BigWig(remoteFile, header, cirTree, cm, zoomIndices);
      });
  }

  constructor(remoteFile, header, cirTree, contigMap:{[key:string]: number}, zoomIndices: Object[]) {
    super(remoteFile, header, cirTree, contigMap);

    this.zoomIndices = zoomIndices || [];
    this.zoomBases = [1];
    this.zoomIndexMap = {};
    this.zoomIndices.forEach(zoomIndex => {
      this.zoomBases.push(zoomIndex.reductionLevel);
      this.zoomIndexMap[zoomIndex.reductionLevel] = zoomIndex;
    });
  }

  // Internal function for fetching features by block.
  _fetchFeaturesByBlock(range:ContigInterval<number>):Q.Promise<WigBlock[]> {
    var blocks = this._findOverlappingBlocks(range);
    if (blocks.length === 0) {
      return Q.when([]);
    }

    // Find the range in the file which contains all relevant blocks.
    // In theory there could be gaps between blocks, but it's hard to see how.
    var byteRange = Interval.boundingInterval(
      blocks.map(n => new Interval(+n.offset, n.offset + n.size)));

    return this.remoteFile.getBytes(byteRange.start, byteRange.length())
      .then(buffer => {
        return blocks.map(block => {
          var beds = [];//extractFeaturesFromBlock(buffer, byteRange, block, this.isCompressed);
          if (block.startChromIx != block.endChromIx) {
            throw `Can't handle blocks which span chromosomes!`;
          }

          return {
            range: new ContigInterval(block.startChromIx, block.startBase, block.endBase),
            rows: beds
          };
        });
      });
  }

  // Find all blocks containing features which intersect with contigRange.
  _findOverlappingBlocks(range: ContigInterval<number>) {

    var matchingBlocks = [];

    var tupleRange = [
      [range.contig, range.start()],
      [range.contig, range.stop()]
    ];

    // TODO: do a recursive search through the index tree. Currently assumes the tree is just one root node.
    this.cirTree.blocks.contents.forEach(node => {
      var nodeRange =
        [
          [node.startChromIx, node.startBase],
          [node.endChromIx, node.endBase]
        ];

      if (utils.tupleRangeOverlaps(nodeRange, tupleRange)) {
        matchingBlocks.push(node);
      }
    });

    return matchingBlocks;
  }

  getBuckets(range:ContigInterval<string>, numBuckets: number): Q.Promise<Array<Bucket>> {
    return Q.when([]);
  }
}

module.exports = BigWig;
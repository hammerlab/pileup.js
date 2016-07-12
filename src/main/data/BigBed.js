/**
 * This (internal) version of the BigBed class has no promises for headers,
 * only immediate data. This greatly simplifies writing methods on it.
 * @flow
 */
'use strict';

import Q from 'q';
import _ from 'underscore';
import pako from 'pako/lib/inflate';  // for gzip inflation
import jBinary from 'jbinary';

import Interval from '../Interval';
import ContigInterval from '../ContigInterval';
import BigBedWig from './BigBedWig';
import utils from '../utils';
import {BigBedTypeSet, BedBlockTypeSet} from './formats/bbi';

type BedRow = {
  // Half-open interval for the BED row.
  contig: string;
  start: number;
  stop: number;
  // Remaining fields in the BED row (typically tab-delimited)
  rest: string;
}

type ChrIdBedRow = {
  chrId: number;
  start: number;
  stop: number;  // note: not inclusive
  rest: string;
}

// All features found in range.
type BedBlock = {
  range: ContigInterval<string>;
  rows: BedRow[];
}

type ChrIdBedBlock = {
  range: ContigInterval<number>;
  rows: ChrIdBedRow[];
}

// A copy of LeafData from bbi.js.
type LeafData = {
  startChromIx: number;
  startBase: number;
  endChromIx: number;
  endBase: number;
  offset: number;
  size: number;
}

function extractFeaturesFromBlock(buffer: ArrayBuffer,
                                  dataRange: Interval,
                                  block: LeafData,
                                  isCompressed: boolean): ChrIdBedRow[] {
  var blockOffset = block.offset - dataRange.start,
    blockLimit = blockOffset + block.size,

    blockBuffer =
      // NOTE: "+ 2" skips over two bytes of gzip header (0x8b1f), which pako.inflateRaw will not handle.
      buffer.slice(
        blockOffset + (isCompressed ? 2 : 0),
        blockLimit
      );

  var inflatedBuffer =
    isCompressed ?
      pako.inflateRaw(new Uint8Array(blockBuffer)) :
      blockBuffer;

  var jb = new jBinary(inflatedBuffer, BedBlockTypeSet);
  // TODO: parse only one Entry at a time from Block, use an iterator.
  return jb.read('Block');
}

class BigBed extends BigBedWig {

  static load(url: string): BigBed {
    return BigBedWig.load(url, BigBedTypeSet).then(([ remoteFile, header, cirTree, contigMap ]) => {
      var cm: {[key:string]: number} = contigMap;
      return new BigBed(remoteFile, header, cirTree, cm);
    });
  }

  /**
   * Returns all features in blocks overlapping the given range.
   * Because these features must all be fetched, decompressed and parsed
   * anyway, this can be helpful for upstream caching.
   */
  getFeatureBlocksOverlapping(range: ContigInterval<string>): Q.Promise<BedBlock[]> {
    var indexRange = this._getChrIdInterval(range);
    return this._fetchFeaturesByBlock(indexRange)
      .then(featureBlocks => {
        // Convert chrIds to contig strings.
        return featureBlocks.map(fb => ({
          range: this._getContigInterval(fb.range),
          rows: this._attachContigToBedRows(fb.rows)
        }));
      });
  }

  /**
   * Returns all BED entries which overlap the range.
   * Note: while the requested range is inclusive on both ends, ranges in
   * bigBed format files are half-open (inclusive at the start, exclusive at
   * the end).
   */
  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<Array<BedRow>> {
    var range = new ContigInterval(contig, start, stop);
    var contigRange = this._getChrIdInterval(range);
    return this._fetchFeaturesByBlock(contigRange)
      .then(bedsByBlock => {
        var beds = _.flatten(bedsByBlock.map(b => b.rows));
        
        beds = beds.filter(function(bed) {
          // Note: BED intervals are explicitly half-open.
          // The "- 1" converts them to closed intervals for ContigInterval.
          var bedInterval = new ContigInterval(bed.chrId, bed.start, bed.stop - 1);
          return contigRange.intersects(bedInterval);
        });

        return this._attachContigToBedRows(beds);
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

  // Internal function for fetching features by block.
  _fetchFeaturesByBlock(range: ContigInterval<number>): Q.Promise<ChrIdBedBlock[]> {
    var blocks = this._findOverlappingBlocks(range);
    if (blocks.length === 0) {
      return Q.when([]);
    }

    // Find the range in the file which contains all relevant blocks.
    // In theory there could be gaps between blocks, but it's hard to see how.
    var byteRange = Interval.boundingInterval(
      blocks.map(n => new Interval(+n.offset, n.offset+n.size)));

    return this.remoteFile.getBytes(byteRange.start, byteRange.length())
      .then(buffer => {
        return blocks.map(block => {
          var beds = extractFeaturesFromBlock(buffer, byteRange, block, this.isCompressed);
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
}

module.exports = BigBed;
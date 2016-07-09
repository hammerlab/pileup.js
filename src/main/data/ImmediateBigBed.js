/**
 * This (internal) version of the BigBed class has no promises for headers,
 * only immediate data. This greatly simplifies writing methods on it.
 * @flow
 */
'use strict';

import Q from 'q';
import pako from 'pako/lib/inflate';  // for gzip inflation

import Interval from '../Interval';
import ContigInterval from '../ContigInterval';
import ImmediateBigBedWig from './ImmediateBigBedWig';

type ChrIdBedRow = {
  chrId: number;
  start: number;
  stop: number;  // note: not inclusive
  rest: string;
}

type ChrIdBedBlock = {
  range: ContigInterval<number>;
  rows: ChrIdBedRow[];
}

function extractFeaturesFromBlock(buffer, dataRange, block, isCompressed): ChrIdBedRow[] {
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

  var jb = new jBinary(inflatedBuffer, bbi.TYPE_SET);
  // TODO: parse only one BedEntry at a time & use an iterator.
  return jb.read('BedBlock');
}

class ImmediateBigBed extends ImmediateBigBedWig {

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

  // Fetch the relevant blocks from the bigBed file and extract the features
  // which overlap the given range.
  // getFeaturesInRange(range: ContigInterval<string>): Q.Promise<BedRow[]> {
  //   var contigRange = this._getChrIdInterval(range);
  //   return this._fetchFeaturesByBlock(contigRange)
  //     .then(bedsByBlock => {
  //       var beds = _.flatten(bedsByBlock.map(b => b.rows));
  //
  //       beds = beds.filter(function(bed) {
  //         // Note: BED intervals are explicitly half-open.
  //         // The "- 1" converts them to closed intervals for ContigInterval.
  //         var bedInterval = new ContigInterval(bed.chrId, bed.start, bed.stop - 1);
  //         return contigRange.intersects(bedInterval);
  //       });
  //
  //       return this._attachContigToBedRows(beds);
  //     });
  // }

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

    var isCompressed = (this.header.uncompressBufSize > 0);
    return this.remoteFile.getBytes(byteRange.start, byteRange.length())
      .then(buffer => {
        return blocks.map(block => {
          var beds = extractFeaturesFromBlock(buffer, byteRange, block, isCompressed);
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

module.exports = ImmediateBigBed;
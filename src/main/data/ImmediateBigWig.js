'use strict';

import Q from 'q';
import _ from 'underscore';
import jBinary from 'jbinary';
import pako from 'pako/lib/inflate';  // for gzip inflation

import Interval from '../Interval';
import ContigInterval from '../ContigInterval';
import bbi from './formats/bbi';
import ImmediateBigBedWig from './ImmediateBigBedWig';


type WigBlock = {
  chrId: number;
  start: number;
  end: number;
  step: number;
  span: number;
  tpe: number;
  count: number;
}


function extractFeaturesFromBlock(buffer, dataRange, block, isCompressed): WigBlock {
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
  return jb.read('WigData');
}


// This (internal) version of the BigBed class has no promises for headers,
// only immediate data. This greatly simplifies writing methods on it.
class ImmediateBigWig extends ImmediateBigBedWig {
  // Internal function for fetching features by block.
  _fetchFeaturesByBlock(range: ContigInterval<number>): Q.Promise<WigBlock[]> {
    var blocks = this.findOverlappingBlocks(range);
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
  
  getFeatureBlocksOverlapping(range: ContigInterval<string>): Q.Promise<WigBlock[]> {
    var indexRange = this.getChrIdInterval(range);
    return this._fetchFeaturesByBlock(indexRange)
      .then(featureBlocks => {
        // Convert chrIds to contig strings.
        return featureBlocks.map(fb => ({
          range: this.getContigInterval(fb.range),
          rows: this.attachContigToBedRows(fb.rows)
        }));
      });
  }
}

module.exports = ImmediateBigWig;
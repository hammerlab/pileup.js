/**
 * Parser for bigBed format.
 * Based on UCSC's src/inc/bbiFile.h
 * @flow
 */
'use strict';

import Q from 'q';
import _ from 'underscore';
import jBinary from 'jbinary';
import pako from 'pako/lib/inflate';  // for gzip inflation

import RemoteFile from '../RemoteFile';
import Interval from '../Interval';
import ContigInterval from '../ContigInterval';
import utils from '../utils';
import bbi from './formats/bbi';


function parseHeader(buffer) {
  // TODO: check Endianness using magic. Possibly use jDataView.littleEndian
  // to flip the endianness for jBinary consumption.
  // NB: dalliance doesn't support big endian formats.
  return new jBinary(buffer, bbi.TYPE_SET).read('Header');
}

// The "CIR" tree contains a mapping from sequence -> block offsets.
// It stands for "Chromosome Index R tree"
function parseCirTree(buffer) {
  return new jBinary(buffer, bbi.TYPE_SET).read('CirTree');
}

// Extract a map from contig name --> contig ID from the bigBed header.
function generateContigMap(header): {[key:string]: number} {
  // Just assume it's a flat "tree" for now.
  var nodes = header.chromosomeTree.nodes.contents;
  if (!nodes) {
    throw 'Invalid chromosome tree';
  }
  return _.object(nodes.map(function({id, key}) {
    // remove trailing nulls from the key string
    return [key.replace(/\0.*/, ''), id];
  }));
}

// Generate the reverse map from contig ID --> contig name.
function reverseContigMap(contigMap: {[key:string]: number}): Array<string> {
  var ary = [];
  _.each(contigMap, (index, name) => {
    ary[index] = name;
  });
  return ary;
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

  var jb = new jBinary(inflatedBuffer, bbi.TYPE_SET);
  // TODO: parse only one BedEntry at a time & use an iterator.
  return jb.read('BedBlock');
}


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

// This (internal) version of the BigBed class has no promises for headers,
// only immediate data. This greatly simplifies writing methods on it.
class ImmediateBigBed {
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
  getContigId(contig: string): number {
    if (contig in this.contigMap) return this.contigMap[contig];
    var chr = 'chr' + contig;
    if (chr in this.contigMap) return this.contigMap[chr];
    throw `Invalid contig ${contig}`;
  }

  getChrIdInterval(range: ContigInterval<string>): ContigInterval<number> {
    return new ContigInterval(
        this.getContigId(range.contig), range.start(), range.stop());
  }

  getContigInterval(range: ContigInterval<number>): ContigInterval<string> {
    return new ContigInterval(
        this.chrIdToContig[range.contig], range.start(), range.stop());
  }

  // Bed entries have a chromosome ID. This converts that to a contig string.
  attachContigToBedRows(beds: ChrIdBedRow[]): BedRow[] {
    return beds.map(bed => ({
      contig: this.chrIdToContig[bed.chrId],
      start: bed.start,
      stop: bed.stop,
      rest: bed.rest
    }));
  }

  // Find all blocks containing features which intersect with contigRange.
  findOverlappingBlocks(range: ContigInterval<number>): Array<LeafData> {
    // Do a recursive search through the index tree
    var matchingBlocks = [];
    var tupleRange = [[range.contig, range.start()],
                      [range.contig, range.stop()]];
    var find = function(node) {
      if (node.contents) {
        node.contents.forEach(find);
      } else {
        var nodeRange =
          [
            [node.startChromIx, node.startBase],
            [node.endChromIx, node.endBase]
          ];

        if (utils.tupleRangeOverlaps(nodeRange, tupleRange)) {
          matchingBlocks.push(node);
        }
      }
    };
    find(this.cirTree.blocks);

    return matchingBlocks;
  }

  // Internal function for fetching features by block.
  fetchFeaturesByBlock(range: ContigInterval<number>): Q.Promise<ChrIdBedBlock[]> {
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

  // TODO: merge this into getFeaturesInRange
  // Fetch the relevant blocks from the bigBed file and extract the features
  // which overlap the given range.
  fetchFeatures(contigRange: ContigInterval<number>): Q.Promise<BedRow[]> {
    return this.fetchFeaturesByBlock(contigRange)
        .then(bedsByBlock => {
          var beds = _.flatten(bedsByBlock.map(b => b.rows));

          beds = beds.filter(function(bed) {
            // Note: BED intervals are explicitly half-open.
            // The "- 1" converts them to closed intervals for ContigInterval.
            var bedInterval = new ContigInterval(bed.chrId, bed.start, bed.stop - 1);
            return contigRange.intersects(bedInterval);
          });

          return this.attachContigToBedRows(beds);
        });
  }

  getFeaturesInRange(range: ContigInterval<string>): Q.Promise<BedRow[]> {
    return this.fetchFeatures(this.getChrIdInterval(range));
  }

  getFeatureBlocksOverlapping(range: ContigInterval<string>): Q.Promise<BedBlock[]> {
    var indexRange = this.getChrIdInterval(range);
    return this.fetchFeaturesByBlock(indexRange)
        .then(featureBlocks => {
          // Convert chrIds to contig strings.
          return featureBlocks.map(fb => ({
            range: this.getContigInterval(fb.range),
            rows: this.attachContigToBedRows(fb.rows)
          }));
        });
  }

}


class BigBed {
  remoteFile: RemoteFile;
  header: Q.Promise<any>;
  cirTree: Q.Promise<any>;
  contigMap: Q.Promise<{[key:string]: number}>;
  immediate: Q.Promise<ImmediateBigBed>;

  /**
   * Prepare to request features from a remote bigBed file.
   * The remote source must support HTTP Range headers.
   * This will kick off several async requests for portions of the file.
   */
  constructor(url: string) {
    this.remoteFile = new RemoteFile(url);
    this.header = this.remoteFile.getBytes(0, 64*1024).then(parseHeader);
    this.contigMap = this.header.then(generateContigMap);

    // Next: fetch the block index and parse out the "CIR" tree.
    this.cirTree = this.header.then(header => {
      // zoomHeaders[0].dataOffset is the next entry in the file.
      // We assume the "cirTree" section goes all the way to that point.
      // Lacking zoom headers, assume it's 4k.
      // TODO: fetch more than 4k if necessary
      var start = header.unzoomedIndexOffset,
          zoomHeader = header.zoomHeaders[0],
          length = zoomHeader ? zoomHeader.dataOffset - start : 4096;
      return this.remoteFile.getBytes(start, length).then(parseCirTree);
    });

    this.immediate = Q.all([this.header, this.cirTree, this.contigMap])
        .then(([header, cirTree, contigMap]) => {
          var cm: {[key:string]: number} = contigMap;
          return new ImmediateBigBed(this.remoteFile, header, cirTree, cm);
        });

    // Bubble up errors
    this.immediate.done();
  }

  /**
   * Returns all BED entries which overlap the range.
   * Note: while the requested range is inclusive on both ends, ranges in
   * bigBed format files are half-open (inclusive at the start, exclusive at
   * the end).
   */
  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<Array<BedRow>> {
    var range = new ContigInterval(contig, start, stop);
    return this.immediate.then(im => im.getFeaturesInRange(range));
  }

  /**
   * Returns all features in blocks overlapping the given range.
   * Because these features must all be fetched, decompressed and parsed
   * anyway, this can be helpful for upstream caching.
   */
  getFeatureBlocksOverlapping(range: ContigInterval<string>): Q.Promise<Array<BedBlock>> {
    return this.immediate.then(im => im.getFeatureBlocksOverlapping(range));
  }
}

module.exports = BigBed;

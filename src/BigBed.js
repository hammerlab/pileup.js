/**
 * Parser for bigBed format.
 * Based on UCSC's src/inc/bbiFile.h
 */
'use strict';

var Q = require('q'),
    _ = require('underscore'),
    jBinary = require('jbinary'),
    pako = require('pako');  // for gzip inflation
    

var RemoteFile = require('./RemoteFile'),
    Interval = require('./Interval'),
    ContigInterval = require('./ContigInterval'),
    utils = require('./utils.js'),
    bbi = require('./formats/bbi');


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

// TODO: create an "ImmediateTwoBit" class and make most of the following
// functions methods on it.

// Extract a map from contig name --> contig ID from the bigBed header.
function generateContigMap(twoBitHeader): {[key:string]: number} {
  // Just assume it's a flat "tree" for now.
  var nodes = twoBitHeader.chromosomeTree.nodes.contents;
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
  _.forEach(contigMap, (index, name) => {
    ary[index] = name;
  });
  return ary;
}

// Map contig name to contig ID. Leading "chr" is optional.
function getContigId(contigMap, contig) {
  if (contig in contigMap) {
    return contigMap[contig];
  }
  var chr = 'chr' + contig;
  if (chr in contigMap) {
    return contigMap[chr];
  }
  return null;
}

// Find all blocks containing features which intersect with contigRange.
function findOverlappingBlocks(twoBitHeader, cirTree, contigRange) {
  // Do a recursive search through the index tree
  var matchingBlocks = [];
  var tupleRange = [[contigRange.contig, contigRange.start()],
                    [contigRange.contig, contigRange.stop()]];
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
  find(cirTree.blocks);

  return matchingBlocks;
}

function extractFeaturesFromBlock(buffer, dataRange, block) {
  var blockOffset = block.offset - dataRange.start,
      blockLimit = blockOffset + block.size,
      // TODO: where does the +2 come from? (I copied it from dalliance)
      blockBuffer = buffer.slice(blockOffset + 2, blockLimit);
  // TODO: only inflate if necessary
  var inflatedBuffer = pako.inflateRaw(new Uint8Array(blockBuffer));

  var jb = new jBinary(inflatedBuffer, bbi.TYPE_SET);
  // TODO: parse only one BedEntry at a time & use an iterator.
  return jb.read('BedBlock');
}

// bed entries have a chromosome ID. This converts that to a contig string.
// Note: modifies beds in-place.
function attachContigToBedRows(beds, contigMap) {
  var reverseMap = reverseContigMap(contigMap);
  beds.forEach(bed => {
    bed.contig = reverseMap[bed.chrId];
    delete bed.chrId;
  });
  return beds;
}


// Internal function for fetching features by block.
function fetchFeaturesByBlock(contigRange, header, cirTree, remoteFile): Array<BedBlock> {
  var blocks = findOverlappingBlocks(header, cirTree, contigRange);
  if (blocks.length === 0) {
    return Q.when([]);
  }

  // Find the range in the file which contains all relevant blocks.
  // In theory there could be gaps between blocks, but it's hard to see how.
  var range = Interval.boundingInterval(
      blocks.map(n => new Interval(+n.offset, n.offset+n.size)));

  return remoteFile.getBytes(range.start, range.length())
      .then(buffer => {
        return blocks.map(block => {
          var beds = extractFeaturesFromBlock(buffer, range, block);
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


// Fetch the relevant blocks from the bigBed file and extract the features
// which overlap the given range.
function fetchFeatures(contigRange, header, cirTree, contigMap, remoteFile) {
  return fetchFeaturesByBlock(contigRange, header, cirTree, remoteFile)
      .then(bedsByBlock => {
        var beds = _.flatten(_.pluck(bedsByBlock, 'rows'));

        beds = beds.filter(function(bed) {
          // Note: BED intervals are explicitly half-open.
          // The "- 1" converts them to closed intervals for ContigInterval.
          var bedInterval = new ContigInterval(bed.chrId, bed.start, bed.stop - 1);
          return contigRange.intersects(bedInterval);
        });

        return attachContigToBedRows(beds, contigMap);
      });
}


type BedRow = {
  // Half-open interval for the BED row.
  contig: string;
  start: number;
  stop: number;
  // Remaining fields in the BED row (typically tab-delimited)
  rest: string;
}

// All features found in range.
type BedBlock = {
  range: ContigInterval<string>;
  rows: BedRow[];
}


class BigBed {
  remoteFile: RemoteFile;
  header: Q.Promise<any>;
  cirTree: Q.Promise<any>;
  contigMap: Q.Promise<{[key:string]: number}>;

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
    
    // XXX: are these necessary? what's the right way to propagate errors?
    this.header.done();
    this.contigMap.done();
    this.cirTree.done();
  }

  /**
   * Returns all BED entries which overlap the range.
   * Note: while the requested range is inclusive on both ends, ranges in
   * bigBed format files are half-open (inclusive at the start, exclusive at
   * the end).
   */
  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<Array<BedRow>> {
    return Q.spread([this.header, this.cirTree, this.contigMap],
                    (header, cirTree, contigMap) => {
      var contigIx = getContigId(contigMap, contig);
      if (contigIx === null) {
        throw `Invalid contig ${contig}`;
      }
      var contigRange = new ContigInterval(contigIx, start, stop);
      return fetchFeatures(contigRange, header, cirTree, contigMap, this.remoteFile);
    });
  }

  /**
   * Returns all features in blocks overlapping the given range.
   * Because these features must all be fetched, decompressed and parsed
   * anyway, this can be helpful for upstream caching.
   */
  getFeatureBlocksOverlapping(range: ContigInterval<string>): Q.Promise<Array<BedBlock>> {
    return Q.spread([this.header, this.cirTree, this.contigMap],
                    (header, cirTree, contigMap) => {
      var contigIx = getContigId(contigMap, range.contig);
      if (contigIx === null) {
        throw `Invalid contig ${range.contig}`;
      }
      var indexRange = new ContigInterval(contigIx, range.start(), range.stop());
      return fetchFeaturesByBlock(indexRange, header, cirTree, this.remoteFile)
          .then(featureBlocks => {
            // Convert chrIds to contig strings.
            featureBlocks.forEach(fb => {
              fb.range.contig = reverseContigMap(contigMap)[fb.range.contig];
              attachContigToBedRows(fb.rows, contigMap);
            });
            return featureBlocks;
          });
    });
  }
}

module.exports = BigBed;

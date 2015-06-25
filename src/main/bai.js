/**
 * Tools for working with indexed BAM (BAI) files.
 * These have nothing to say about parsing the BAM file itself. For that, see
 * bam.js.
 * @flow
 */
'use strict';

import type * as RemoteFile from './RemoteFile';
import type * as ContigInterval from './ContigInterval';
import type {Chunk} from './types';

var jBinary = require('jbinary'),
    jDataView = require('jdataview'),
    _ = require('underscore'),
    Q = require('q'),
    bamTypes = require('./formats/bamTypes'),
    VirtualOffset = require('./VirtualOffset');


// In the event that index chunks aren't available from an external source, it
// winds up saving time to do a fast pass over the data to compute them. This
// allows us to parse a single contig at a time using jBinary.
function computeIndexChunks(buffer) {
  var view = new jDataView(buffer, 0, buffer.byteLength, true /* little endian */);

  var minBlockIndex = Infinity;
  var contigStartOffsets = [];
  view.getInt32();  // magic
  var n_ref = view.getInt32();
  for (var j = 0; j < n_ref; j++) {
    contigStartOffsets.push(view.tell());
    var n_bin = view.getInt32();
    for (var i = 0; i < n_bin; i++) {
      view.getUint32();  // bin ID
      var n_chunk = view.getInt32();
      view.skip(n_chunk * 16);
    }
    var n_intv = view.getInt32();
    if (n_intv) {
      var offset = VirtualOffset.fromBlob(view.getBytes(8), 0),
          coffset = offset.coffset + (offset.uoffset ? 65536 : 0);
      if (coffset) {
        minBlockIndex = Math.min(coffset, minBlockIndex);
      }
      view.skip((n_intv - 1) * 8);
    }
  }
  contigStartOffsets.push(view.tell());

  return {
    chunks: _.zip(_.initial(contigStartOffsets), _.rest(contigStartOffsets)),
    minBlockIndex
  };
}


function readChunks(buf) {
  return new jBinary(buf, bamTypes.TYPE_SET).read('ChunksArray');
}

function readIntervals(blob: Uint8Array) {
  var intervals = new Array(Math.floor(blob.length / 8));
  for (var pos = 0; pos < blob.length - 7; pos += 8) {
    intervals[pos >> 3] = VirtualOffset.fromBlob(blob, pos);
  }
  return intervals;
}

function doChunksOverlap(a: Chunk, b: Chunk) {
  return a.chunk_beg.isLessThanOrEqual(b.chunk_end) &&
         b.chunk_beg.isLessThanOrEqual(a.chunk_end);
}

function areChunksAdjacent(a: Chunk, b: Chunk) {
  return a.chunk_beg.isEqual(b.chunk_end) || a.chunk_end.isEqual(b.chunk_beg);
}

// This coalesces adjacent & overlapping chunks to minimize fetches.
// It also applies the "linear optimization", which can greatly reduce the
// number of network fetches needed to fulfill a request.
function optimizeChunkList(chunkList: Chunk[], minimumOffset: VirtualOffset): Chunk[] {
  chunkList.sort((a, b) => {
    var result = a.chunk_beg.compareTo(b.chunk_beg);
    if (result === 0) {
      result = a.chunk_end.compareTo(b.chunk_end);
    }
    return result;
  });

  var newChunks = [];
  chunkList.forEach(chunk => {
    if (chunk.chunk_end.isLessThan(minimumOffset)) {
      return;  // linear index optimization
    }

    if (newChunks.length === 0) {
      newChunks.push(chunk);
      return;
    }

    var lastChunk = newChunks[newChunks.length - 1];
    if (!doChunksOverlap(lastChunk, chunk) &&
        !areChunksAdjacent(lastChunk, chunk)) {
      newChunks.push(chunk);
    } else {
      if (lastChunk.chunk_end.isLessThan(chunk.chunk_end)) {
        lastChunk.chunk_end = chunk.chunk_end;
      }
    }
  });

  return newChunks;
}

// This version of BaiFile is not completely immediate, but it does guarantee
// that the index chunks are available.
class ImmediateBaiFile {
  buffer: ?ArrayBuffer;
  remoteFile: RemoteFile;
  indexChunks: Object;
  indexCache: Q.Promise<Object>[];  // ref ID -> parsed BaiIndex
  intervalsCache: Array<?VirtualOffset[]>;  // ref ID -> linear index

  constructor(buffer: ?ArrayBuffer, remoteFile: RemoteFile, indexChunks?: Object) {
    this.buffer = buffer;
    this.remoteFile = remoteFile;
    if (buffer) {
      this.indexChunks = computeIndexChunks(buffer);
    } else {
      if (indexChunks) {
        this.indexChunks = indexChunks;
      } else {
        throw 'Without index chunks, the entire BAI buffer must be loaded';
      }
    }
    this.indexCache = new Array(this.indexChunks.chunks.length);
    this.intervalsCache = new Array(this.indexChunks.chunks.length);
  }

  getChunksForInterval(range: ContigInterval<number>): Q.Promise<Chunk[]> {
    if (range.contig < 0 || range.contig > this.indexChunks.chunks.length) {
      return Q.reject(`Invalid contig ${range.contig}`);
    }

    var bins = reg2bins(range.start(), range.stop() + 1);

    return this.indexForContig(range.contig).then(contigIndex => {
      var chunks = _.chain(contigIndex.bins)
                    .filter(b => bins.indexOf(b.bin) >= 0)
                    .map(b => readChunks(b.chunks))
                    .flatten()
                    .value();

      var linearIndex = this.getIntervals(contigIndex.intervals, range.contig);
      var startIdx = Math.max(0, Math.floor(range.start() / 16384));
      var minimumOffset = linearIndex[startIdx];

      chunks = optimizeChunkList(chunks, minimumOffset);

      return chunks;
    });
  }

  // Retrieve and parse the index for a particular contig.
  indexForContig(contig: number): Q.Promise<Object> {
    var v = this.indexCache[contig];
    if (v) {
      return v;
    }

    var [start, stop] = this.indexChunks.chunks[contig];
    this.indexCache[contig] = this.getSlice(start, stop).then(buffer => {
      var jb = new jBinary(buffer, bamTypes.TYPE_SET);
      return jb.read('BaiIndex');
    });
    return this.indexCache[contig];
  }

  getSlice(start: number, stop: number): Q.Promise<ArrayBuffer> {
    if (this.buffer) {
      return Q.when(this.buffer.slice(start, stop));
    } else {
      return this.remoteFile.getBytes(start, stop - start + 1);
    }
  }

  // Cached wrapper around readIntervals()
  getIntervals(blob: Uint8Array, refId: number): VirtualOffset[] {
    var linearIndex = this.intervalsCache[refId];
    if (linearIndex) {
      return linearIndex;
    }
    linearIndex = readIntervals(blob);
    this.intervalsCache[refId] = linearIndex;
    return linearIndex;
  }
}


class BaiFile {
  remoteFile: RemoteFile;
  immediate: Q.Promise<ImmediateBaiFile>;

  constructor(remoteFile: RemoteFile, indexChunks?: Object) {
    this.remoteFile = remoteFile;
    if (indexChunks) {
      this.immediate = Q.when(new ImmediateBaiFile(null, remoteFile, indexChunks));
    } else { 
      this.immediate = remoteFile.getAll().then(buf => {
        return new ImmediateBaiFile(buf, remoteFile, indexChunks);
      });
    }
    this.immediate.done();
  }

  getChunksForInterval(range: ContigInterval<number>): Q.Promise<Chunk[]> {
    return this.immediate.then(immediate => {
      return immediate.getChunksForInterval(range);
    });
  }

  getHeaderSize(): Q.Promise<number> {
    return this.immediate.then(immediate => {
      return immediate.indexChunks.minBlockIndex;
    });
  }
}


// These functions come directly from the SAM paper
// See https://samtools.github.io/hts-specs/SAMv1.pdf section 5.3

// calculate the list of bins that may overlap with region [beg,end) (zero-based)
function reg2bins(beg, end) {
  var k, list = [];
  --end;
  list.push(0);
  for (k =    1 + (beg>>26); k <=    1 + (end>>26); ++k) list.push(k);
  for (k =    9 + (beg>>23); k <=    9 + (end>>23); ++k) list.push(k);
  for (k =   73 + (beg>>20); k <=   73 + (end>>20); ++k) list.push(k);
  for (k =  585 + (beg>>17); k <=  585 + (end>>17); ++k) list.push(k);
  for (k = 4681 + (beg>>14); k <= 4681 + (end>>14); ++k) list.push(k);
  return list;
}

module.exports = BaiFile;

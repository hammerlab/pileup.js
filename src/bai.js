/**
 * Tools for working with indexed BAM (BAI) files.
 * These have nothing to say about parsing the BAM file itself. For that, see
 * bam.js.
 * @flow
 */

import type * as RemoteFile from './RemoteFile';
import type * as ContigInterval from './ContigInterval';
import type * as Q from 'q';

var bamTypes = require('./formats/bamTypes');
var jBinary = require('jbinary');
var jDataView = require('jdataview');
var Interval = require('./Interval');
var VirtualOffset = require('./VirtualOffset');
var _ = require('underscore');

/*

General notes about BAI format:
- It's a multi-level index: each particular locus is covered by several "bins" of different sizes.
- It's an index of ranges (the reads). Each range gets places in the smallest bucket which contains it. So while most reads will be in small bins, it's still necessary to look in the large bins for reads which might cross smaller bin boundaries.

In the BAI format, each bin spans either:
- 512Mbp (bin 0)
- 64Mbp  (bins 1-8)
- 8Mbp   (bins 9-72)
- 1Mbp   (bins 73-584)
- 128kbp (bins 585-4680)
- 16kbp  (bins 4681-37448)

The BAI file stores the file start/stop offsets for each bin.
It *also* stores a linear index, which can be used to avoid lookups in larger bins.
*/


// In the event that index chunks aren't available from an external source, it
// winds up saving time to do a fast pass over the data to compute them. This
// allows us to parse a single contig at a time using jBinary.
function computeIndexChunks(buffer) {
  var view = new jDataView(buffer, 0, buffer.byteLength, true /* little endian */);

  var contigStartOffsets = [];
  view.getInt32();  // magic
  var n_ref = view.getInt32();
  for (var j = 0; j < n_ref; j++) {
    contigStartOffsets.push(view.tell());
    var n_bin = view.getInt32();
    for (var i = 0; i < n_bin; i++) {
      var bin = view.getUint32();
      var n_chunk = view.getInt32();
      view.skip(n_chunk * 16);
    }
    var n_intv = view.getInt32();
    view.skip(n_intv * 8);
  }
  contigStartOffsets.push(view.tell());
  var n_no_coor = view.getUint64();

  return {
    chunks: _.zip(_.initial(contigStartOffsets), _.rest(contigStartOffsets)),
    minBlockIndex: 0  // TODO: compute this if it's helpful
  };
}


function readChunks(buf) {
  return new jBinary(buf, bamTypes.TYPE_SET).read('ChunksArray');
  // return new jBinary(buf, bamTypes.TYPE_SET).read(['array', 'uint64']);
}

function readIntervals(buf) {
  return new jBinary(buf, bamTypes.TYPE_SET).read('IntervalsArray');
}

type Chunk = {
  chunk_beg: VirtualOffset;
  chunk_end: VirtualOffset;
}

function doChunksOverlap(a: Chunk, b: Chunk) {
  return a.chunk_beg.isLessThanOrEqual(b.chunk_end) &&
         b.chunk_beg.isLessThanOrEqual(a.chunk_end);
}

function areChunksAdjacent(a: Chunk, b: Chunk) {
  return a.chunk_beg.isEqual(b.chunk_end) || a.chunk_end.isEqual(b.chunk_beg);
}

// This coalesces adjacent & overlapping chunks to minimize fetches.
function optimizeChunkList(chunkList: Chunk[], minimumOffset: VirtualOffset): Chunk[] {
  chunkList.sort((a, b) => {
    var result = a.chunk_beg.compareTo(b.chunk_beg);
    if (result == 0) {
      result = a.chunk_end.compareTo(b.chunk_end);
    }
    return result;
  });

  var newChunks = [];
  chunkList.forEach(chunk => {
    if (chunk.chunk_end.isLessThan(minimumOffset)) {
      return;  // linear index optimization
    }

    if (newChunks.length == 0) {
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

class ImmediateBaiFile {
  buffer: ArrayBuffer;
  indexChunks: Object;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.indexChunks = computeIndexChunks(buffer);
  }

  getChunksForInterval(range: ContigInterval<number>): Chunk[] {
    if (range.contig < 0 || range.contig > this.indexChunks.chunks.length) {
      throw `Invalid contig ${range.contig}`;
    }

    var bins = reg2bins(range.start(), range.stop() + 1);

    var contigIndex = this.indexForContig(range.contig);

    var str64 = u64 => u64.hi + ' ' + u64.lo;

    var chunks = _.chain(contigIndex.bins)
                  .filter(b => bins.indexOf(b.bin) >= 0)
                  // .tap(x => console.log(x))
                  .map(b => readChunks(b.chunks))
                  .flatten()
                  .value();

    console.log('Candidate chunks: ', chunks.length);

    var linearIndex = readIntervals(contigIndex.intervals);
    var startIdx = Math.max(0, Math.floor(range.start() / 16384));
    var minimumOffset = linearIndex[startIdx];

    chunks = optimizeChunkList(chunks, minimumOffset);

    console.log('Filtered chunks: ', chunks.length);

    return chunks;
  }

  // Retrieve and parse the index for a particular contig.
  // TODO: make this async
  indexForContig(contig: number): Object {
    var [start, stop] = this.indexChunks.chunks[contig];
    var jb = new jBinary(this.buffer.slice(start, stop), bamTypes.TYPE_SET);
    return jb.read('BaiIndex');
  }
}


class BaiFile {
  remoteFile: RemoteFile;
  immediate: Q.Promise<ImmediateBaiFile>;

  constructor(remoteFile: RemoteFile) {
    this.remoteFile = remoteFile;
    this.immediate = remoteFile.getAll().then(buf => {
      return new ImmediateBaiFile(buf);
    });
    this.immediate.done();
  }

  getChunksForInterval(range: ContigInterval<number>): Q.Promise<Chunk[]> {
    return this.immediate.then(immediate => {
      return immediate.getChunksForInterval(range);
    });
  }
}


// These functions come directly from the SAM paper
// See https://samtools.github.io/hts-specs/SAMv1.pdf section 5.3

// calculate bin given an alignment covering [beg,end)
// (zero-based, half-closed-half-open)
function reg2bin(beg, end) {
  --end;
  if (beg>>14 == end>>14) return ((1<<15)-1)/7 + (beg>>14);
  if (beg>>17 == end>>17) return ((1<<12)-1)/7 + (beg>>17);
  if (beg>>20 == end>>20) return ((1<<9)-1)/7  + (beg>>20);
  if (beg>>23 == end>>23) return ((1<<6)-1)/7  + (beg>>23);
  if (beg>>26 == end>>26) return ((1<<3)-1)/7  + (beg>>26);
  return 0;
}

// calculate the list of bins that may overlap with region [beg,end) (zero-based)
function reg2bins(beg, end) {
  var i = 0, k, list = [];
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

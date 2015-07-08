/**
 * Tools for parsing BAM files.
 * See https://samtools.github.io/hts-specs/SAMv1.pdf
 * @flow
 */
'use strict';

import type * as RemoteFile from './RemoteFile';

var jBinary = require('jbinary'),
    jDataView = require('jdataview'),
    _ = require('underscore'),
    Q = require('q');

import type {Chunk, InflatedBlock} from './types';

var bamTypes = require('./formats/bamTypes'),
    utils = require('./utils'),
    BaiFile = require('./bai'),
    ContigInterval = require('./ContigInterval'),
    VirtualOffset = require('./VirtualOffset'),
    SamRead = require('./SamRead');


/**
 * The 'contained' parameter controls whether the alignments must be fully
 * contained within the range, or need only overlap it.
 */
function isAlignmentInRange(read: SamRead,
                            idxRange: ContigInterval<number>,
                            contained: boolean): boolean {
  // TODO: Use cigar.getReferenceLength() instead of l_seq, like htsjdk. 
  var readRange = new ContigInterval(read.refID, read.pos, read.pos + read.l_seq - 1);
  if (contained) {
    return idxRange.containsInterval(readRange);
  } else {
    return readRange.intersects(idxRange);
  }
}


var kMaxFetch = 65536 * 2;

// Read a single alignment
function readAlignment(view: jDataView, pos: number,
                       offset: VirtualOffset, refName: string) {
  var readLength = view.getInt32(pos);
  pos += 4;

  if (pos + readLength > view.byteLength) {
    return null;
  }

  var readSlice = view.buffer.slice(pos, pos + readLength);

  var read = new SamRead(readSlice, offset.clone(), refName);
  return {
    read,
    readLength: 4 + readLength
  };
}

// This tracks how many bytes were read.
function readAlignmentsToEnd(buffer: ArrayBuffer,
                             refName: string,
                             idxRange: ContigInterval<number>,
                             contained: boolean,
                             offset: VirtualOffset,
                             blocks: InflatedBlock[],
                             alignments: SamRead[]) {
  // We use jDataView and ArrayBuffer directly for a speedup over jBinary.
  // This parses reads ~2-3x faster than using ThinAlignment directly.
  var jv = new jDataView(buffer, 0, buffer.byteLength, true /* little endian */);
  var shouldAbort = false;
  var pos = 0;
  offset = offset.clone();
  var blockIndex = 0;
  try {
    while (pos < buffer.byteLength) {
      var readData = readAlignment(jv, pos, offset, refName);
      if (!readData) break;

      var {read, readLength} = readData;
      pos += readLength;
      if (isAlignmentInRange(read, idxRange, contained)) {
        alignments.push(read);
      }

      // Advance the VirtualOffset to reflect the new position
      offset.uoffset += readLength;
      var bufLen = blocks[blockIndex].buffer.byteLength;
      if (offset.uoffset >= bufLen) {
        offset.uoffset -= bufLen;
        offset.coffset += blocks[blockIndex].compressedLength;
        blockIndex++;
      }

      // Optimization: if the last alignment started after the requested range,
      // then no other chunks can possibly contain matching alignments.
      // TODO: use contigInterval.isAfterInterval when that's possible.
      var range = new ContigInterval(read.refID, read.pos, read.pos + 1);
      if (range.contig > idxRange.contig ||
          (range.contig == idxRange.contig && range.start() > idxRange.stop())) {
        shouldAbort = true;
        break;
      }
    }
    // Code gets here if the compression block ended exactly at the end of
    // an Alignment.
  } catch (e) {
    // Partial record
    if (!(e instanceof RangeError)) {
      throw e;
    }
  }

  return {
    shouldAbort,
    nextOffset: offset
  };
}

// Fetch alignments from the remote source at the locations specified by Chunks.
// This can potentially result in many network requests.
// The returned promise is fulfilled once it can be proved that no more
// alignments need to be fetched.
function fetchAlignments(remoteFile: RemoteFile,
                         refName: string,
                         idxRange: ContigInterval<number>,
                         contained: boolean,
                         chunks: Chunk[]): Q.Promise<SamRead[]> {

  var numRequests = 0,
      alignments = [],
      deferred = Q.defer();

  function fetch(chunks) {
    if (chunks.length === 0) {
      deferred.resolve(alignments);
      return;
    }

    // Never fetch more than 128k at a time -- this reduces contention on the
    // main thread and can avoid sending unnecessary bytes over the network.
    var chunk = chunks[0],
        chunk_beg = chunk.chunk_beg.coffset,
        chunk_end = chunk.chunk_end.coffset;
    var bytesToFetch = Math.min(kMaxFetch, (chunk_end + 65536) - chunk_beg);
    remoteFile.getBytes(chunk_beg, bytesToFetch).then(buffer => {
      numRequests++;
      deferred.notify({numRequests});
      var cacheKey = {
        filename: remoteFile.url,
        initialOffset: chunk_beg
      };
      var blocks = utils.inflateConcatenatedGzip(buffer, chunk_end - chunk_beg, cacheKey);

      // If the chunk hasn't been exhausted, resume it at an appropriate place.
      // The last block needs to be re-read, since it may not have been exhausted.
      var lastBlock = blocks[blocks.length - 1],
          lastByte = chunk_beg + lastBlock.offset - 1,
          newChunk = null;
      if (blocks.length > 1 && lastByte < chunk_end) {
        newChunk = {
          chunk_beg: new VirtualOffset(lastByte + 1, 0),
          chunk_end: chunk.chunk_end
        };
      }

      var buffers = blocks.map(x => x.buffer);
      buffers[0] = buffers[0].slice(chunk.chunk_beg.uoffset);
      var decomp = utils.concatArrayBuffers(buffers);
      if (decomp.byteLength > 0) {
        var {shouldAbort, nextOffset} =
            readAlignmentsToEnd(decomp, refName, idxRange, contained,
                                chunk.chunk_beg, blocks, alignments);
        if (shouldAbort) {
          deferred.resolve(alignments);
          return;
        }
        if (newChunk) {
          newChunk.chunk_beg = nextOffset;
        }
      } else {
        newChunk = null;  // This is most likely EOF
      }

      fetch((newChunk ? [newChunk] : []).concat(_.rest(chunks)));
    });
  }

  fetch(chunks);
  return deferred.promise;
}

 
class Bam {
  index: ?BaiFile;
  header: Q.Promise<Object>;
  remoteFile: RemoteFile;
  hasIndexChunks: boolean;

  constructor(remoteFile: RemoteFile,
              remoteIndexFile?: RemoteFile,
              indexChunks?: Object) {
    this.remoteFile = remoteFile;
    this.index = remoteIndexFile ? new BaiFile(remoteIndexFile, indexChunks) : null;
    this.hasIndexChunks = !!indexChunks;

    var sizePromise = this.index ? this.index.getHeaderSize() : Q.when(2 * 65535);
    this.header = sizePromise.then(size => {
      var def = Q.defer();
      // This happens in the next event loop to give listeners a chance to register.
      Q.when().then(() => { def.notify({status: 'Fetching BAM header'}); });
      utils.pipePromise(
          def,
          this.remoteFile.getBytes(0, size).then(buf => {
            var decomp = utils.inflateGzip(buf);
            var jb = new jBinary(decomp, bamTypes.TYPE_SET);
            return jb.read('BamHeader');
          }));
      return def.promise;
    });
    this.header.done();
  }

  /**
   * Reads the entire BAM file from the remote source and parses it.
   * Since BAM files can be enormous (hundreds of GB), this is only recommended
   * for small test inputs.
   */
  readAll(): Q.Promise<Object> {
    return this.remoteFile.getAll().then(buf => {
      var decomp = utils.inflateGzip(buf);
      var jb = new jBinary(decomp, bamTypes.TYPE_SET);
      var o = jb.read('BamFile');
      // Do some mild re-shaping.
      var vo = new VirtualOffset(0, 0);
      var slice = function(u8: Uint8Array) {
        return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength - 1);
      };
      o.alignments = o.alignments.map(x => {
        var r = new SamRead(slice(x.contents), vo, '');
        if (r.refID != -1) {
          r.ref = o.header.references[r.refID].name;
        }
        return r;
      });
      return o;
    });
  }

  /**
   * Fetch a single read at the given VirtualOffset.
   * This is insanely inefficient and should not be used outside of testing.
   */
  readAtOffset(offset: VirtualOffset): Q.Promise<SamRead> {
    return this.remoteFile.getBytes(offset.coffset, kMaxFetch).then(gzip => {
      var buf = utils.inflateGzip(gzip);
      var jv = new jDataView(buf, 0, buf.byteLength, true /* little endian */);
      var readData = readAlignment(jv, offset.uoffset, offset, '');
      if (!readData) {
        throw `Unable to read alignment at ${offset} in ${this.remoteFile.url}`;
      } else {
        // Attach the human-readable ref name
        var read = readData.read;
        return this.header.then(header => {
          read.ref = header.references[read.refID].name;
          return read;
        });
      }
    });
  }

  /**
   * Map a contig name to a contig index and canonical name.
   */
  getContigIndex(contigName: string): Q.Promise<{idx: number; name: string}> {
    return this.header.then(header => {
      for (var i = 0; i < header.references.length; i++) {
        var name = header.references[i].name;
        if (name == contigName ||
            name == 'chr' + contigName ||
            'chr' + name == contigName) {
          return {idx: i, name: name};
        }
      }
      throw `Invalid contig name: ${contigName}`;
    });
  }

  /**
   * Fetch all the alignments which overlap a range.
   * The 'contained' parameter controls whether the alignments must be fully
   * contained within the range, or need only overlap it.
   */
  getAlignmentsInRange(range: ContigInterval<string>, opt_contained?: boolean): Q.Promise<SamRead[]> {
    var contained = opt_contained || false;
    if (!this.index) {
      throw 'Range searches are only supported on BAMs with BAI indices.';
    }
    var index = this.index;

    return this.getContigIndex(range.contig).then(({idx, name}) => {
      var def = Q.defer();
      // This happens in the next event loop to give listeners a chance to register.
      Q.when().then(() => { def.notify({status: 'Fetching BAM index'}); });

      var idxRange = new ContigInterval(idx, range.start(), range.stop());

      utils.pipePromise(
        def,
        index.getChunksForInterval(idxRange).then(chunks => {
          return fetchAlignments(this.remoteFile, name, idxRange, contained, chunks);
        }));
      return def.promise;
    });
  }

}

module.exports = Bam;

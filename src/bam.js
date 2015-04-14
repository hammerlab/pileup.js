/**
 * Tools for parsing BAM files.
 * See https://samtools.github.io/hts-specs/SAMv1.pdf
 * @flow
 */
'use strict';

import type * as RemoteFile from './RemoteFile';

var jBinary = require('jbinary'),
    _ = require('underscore'),
    Q = require('q');

var bamTypes = require('./formats/bamTypes'),
    utils = require('./utils'),
    BaiFile = require('./bai'),
    ContigInterval = require('./ContigInterval'),
    VirtualOffset = require('./VirtualOffset');


/**
 * Filter a list of alignments down to just those which overlap the range.
 * The 'contained' parameter controls whether the alignments must be fully
 * contained within the range, or need only overlap it.
 */
function filterAlignments(alignments: Object[],
                          idxRange: ContigInterval<number>,
                          contained: boolean): Object[] {
  return alignments.filter(read => {
    // TODO: Use cigar.getReferenceLength() instead of l_seq, like htsjdk. 
    var readRange = new ContigInterval(read.refID, read.pos, read.pos + read.l_seq - 1);
    if (contained) {
      return idxRange.containsInterval(readRange);
    } else {
      return readRange.intersects(idxRange);
    }
  });
}


// TODO: import from src/bai.js
type Chunk = {
  chunk_beg: VirtualOffset;
  chunk_end: VirtualOffset;
}

var kMaxFetch = 65536 * 2;


// This tracks how many bytes were read.
function readAlignmentsToEnd(buffer: ArrayBuffer) {
  var jb = new jBinary(buffer, bamTypes.TYPE_SET);
  var alignments = [];
  var lastStartOffset = 0;
  try {
    while (jb.tell() < buffer.byteLength) {
      var alignment = jb.read('ThinBamAlignment');
      if (!alignment) break;
      alignments.push(alignment.contents);
      lastStartOffset = jb.tell();
    }
    // Code gets here if the compression block ended exactly at the end of
    // an Alignment.
  } catch (e) {
    // If stop was specified, it must be precise.
    // Otherwise, allow partial records.
    if (!(e instanceof RangeError)) {
      throw e;
    }
  }

  return {
    alignments,
    lastByteRead: lastStartOffset - 1
  }
}

// Given an offset in a concatenated buffer, determine the offset it
// corresponds to in the original buffer.
function splitOffset(buffers: ArrayBuffer[], chunk: Chunk, lastByteRead: number): number {
  for (var i = 0; i < buffers.length - 1; i++) {
    lastByteRead -= buffers[i].byteLength;
  }
  if (lastByteRead < 0) {
    throw 'Last byte read was not in last chunk';
  }

  if (buffers.length == 1) {
    lastByteRead += chunk.chunk_beg.uoffset;
  }

  return lastByteRead;
}

// Fetch alignments from the remote source at the locations specified by Chunks.
// This can potentially result in many network requests.
// The returned promise is fulfilled once it can be proved that no more
// alignments need to be fetch.
function fetchAlignments(remoteFile: RemoteFile,
                         idxRange: ContigInterval<number>,
                         contained: boolean,
                         chunks: Chunk[],
                         alignments: Object[]): Q.Promise<Object[]> {
  console.log(idxRange, chunks, alignments.length);
  if (chunks.length == 0) {
    return Q.when(alignments);
  }

  // Never fetch more than 128k at a time -- this reduces contention on the
  // main thread and can avoid sending unnecessary bytes over the network.
  var chunk = chunks[0],
      chunk_beg = chunk.chunk_beg.coffset,
      chunk_end = chunk.chunk_end.coffset;
  var bytesToFetch = Math.min(kMaxFetch, (chunk_end + 65535) - chunk_beg);
  return remoteFile.getBytes(chunk_beg, bytesToFetch).then(buffer => {
    var blocks = utils.inflateConcatenatedGzip(buffer, chunk_end - chunk_beg);

    // If the chunk hasn't been exhausted, resume it at an appropriate place.
    var lastBlock = blocks[blocks.length - 1],
        lastByte = chunk_beg + lastBlock.offset + lastBlock.compressedLength - 1,
        newChunk = null;
    if (lastByte < chunk_end) {
      newChunk = {
        chunk_beg: new VirtualOffset(lastByte + 1, 0),
        chunk_end: chunk.chunk_end
      };
    }

    var buffers = blocks.map(x => x.buffer);
    buffers[0] = buffers[0].slice(chunk.chunk_beg.uoffset);
    var decomp = utils.concatArrayBuffers(buffers);
    var {alignments: newAlignments, lastByteRead} = readAlignmentsToEnd(decomp);
    if (newChunk) {
      var lastUOffset = splitOffset(buffers, chunk, lastByteRead);
      newChunk.chunk_beg.uoffset = lastUOffset + 1;
    }
    alignments = alignments.concat(
        filterAlignments(newAlignments, idxRange, contained));

    // Optimization: if the last alignment started after the requested range,
    // then no other chunks can possibly contain matching alignments.
    var lastAlignment = newAlignments[newAlignments.length - 1],
        lastStart = lastAlignment.pos,
        lastRange = new ContigInterval(lastAlignment.refID, lastStart, lastStart + 1);
    if (lastRange.contig > idxRange.contig ||
        (lastRange.contig == idxRange.contig && lastRange.start() > idxRange.start())) {
      return Q.when(alignments);
    } else {
      return fetchAlignments(remoteFile,
                             idxRange,
                             contained,
                             (newChunk ? [newChunk] : []).concat(_.rest(chunks)),
                             alignments);
    }
  });
}

 
class Bam {
  index: ?BaiFile;
  header: Q.Promise<Object>;

  constructor(remoteFile: RemoteFile, remoteIndexFile?: RemoteFile) {
    this.remoteFile = remoteFile;
    this.index = remoteIndexFile ? new BaiFile(remoteIndexFile) : null;

    var sizePromise = this.index ? this.index.getHeaderSize() : Q.when(2 * 65535);
    this.header = sizePromise.then(size => {
      return this.remoteFile.getBytes(0, size).then(buf => {
        var decomp = utils.inflateGzip(buf);
        var jb = new jBinary(decomp, bamTypes.TYPE_SET);
        return jb.read('BamHeader');
      });
    });
    this.header.done();
  }

  /**
   * Reads the entire BAM file from the remote source and parses it.
   * Since BAM files can be enormous (hundreds of GB), this is only recommended
   * for small test inputs.
   *
   * If thinReads is set, only the fields needed to place the read in the
   * genome will be parsed. This typically results in a dramatic (~40x)
   * speedup.
   */
  readAll(thinReads?: boolean): Q.Promise<Object> {
    return this.remoteFile.getAll().then(buf => {
      var decomp = utils.inflateGzip(buf);
      var jb = new jBinary(decomp, bamTypes.TYPE_SET);
      var o = jb.read(thinReads ? 'ThinBamFile' : 'BamFile');
      // Do some mild re-shaping.
      o.alignments = o.alignments.map(x => x.contents);
      return o;
    });
  }

  /**
   * Read alignments for a chunk of the BAM file.
   * If stop is omitted, reads alignments to the end of the compression block.
   */
  readChunk(start: VirtualOffset, stop?: VirtualOffset): Q.Promise<Object[]> {
    var lastCOffset = (stop ? stop.coffset : start.coffset);
    // Blocks are no larger than 64k when compressed
    return this.remoteFile.getBytes(start.coffset,
                                    lastCOffset + 65535).then(buf => {
      var blocks = utils.inflateConcatenatedGzip(buf, lastCOffset - start.coffset).map(x => x.buffer);
      if (stop) {
        var lastBlock = blocks[blocks.length - 1];
        blocks[blocks.length - 1] = lastBlock.slice(0, stop.uoffset);
      }
      blocks[0] = blocks[0].slice(start.uoffset);
      var decomp = utils.concatArrayBuffers(blocks);

      var jb = new jBinary(decomp, bamTypes.TYPE_SET);
      var alignments = [];
      try {
        while (jb.tell() < decomp.byteLength) {
          var alignment = jb.read('ThinBamAlignment');
          if (!alignment) break;
          alignments.push(alignment.contents);
        }
        // Code gets here if the compression block ended exactly at the end of
        // an Alignment.
      } catch (e) {
        // If stop was specified, it must be precise.
        // Otherwise, allow partial records.
        if (stop || !(e instanceof RangeError)) {
          throw e;
        }
      }
      return alignments;
    });
  }

  /**
   * Map a contig name to a contig index.
   */
  getContigIndex(contigName: string): Q.Promise<number> {
    return this.header.then(header => {
      for (var i = 0; i < header.references.length; i++) {
        var name = header.references[i].name;
        if (name == contigName || name == 'chr' + contigName) {
          return i;
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
  getAlignmentsInRange(range: ContigInterval<string>, contained?: boolean): Q.Promise<Object[]> {
    contained = contained || false;
    if (!this.index) {
      throw 'Range searches are only supported on BAMs with BAI indices.';
    }
    var index = this.index;

    return this.getContigIndex(range.contig).then(contigIdx => {
      var idxRange = new ContigInterval(contigIdx, range.start(), range.stop());
      return index.getChunksForInterval(idxRange).then(chunks => {
        return fetchAlignments(this.remoteFile, idxRange, contained, chunks, []);
      });
    });
  }

  // Convert a structured Cigar object into the string format we all love.
  static makeCigarString(cigarOps: Array<{op:string; length:number}>) {
    return cigarOps.map(({op, length}) => length + op).join('');
  }

  // Convert an array of Phred scores to a printable string.
  static makeAsciiPhred(qualities: number[]): string {
    if (qualities.length === 0) return '';
    if (_.every(qualities, x => x == 255)) return '*';
    return qualities.map(q => String.fromCharCode(33 + q)).join('');
  }
}

module.exports = Bam;

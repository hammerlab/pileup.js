/**
 * Tools for parsing BAM files.
 * See https://samtools.github.io/hts-specs/SAMv1.pdf
 * @flow
 */
'use strict';

import type * as RemoteFile from './RemoteFile';
import type * as Q from 'q';
import type * as VirtualOffset from './VirtualOffset';

var jBinary = require('jbinary'),
    _ = require('underscore');

var bamTypes = require('./formats/bamTypes'),
    utils = require('./utils'),
    BaiFile = require('./bai'),
    ContigInterval = require('./ContigInterval');


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
 
class Bam {
  index: ?BaiFile;
  header: Q.Promise<Object>;

  constructor(remoteFile: RemoteFile, remoteIndexFile?: RemoteFile) {
    this.remoteFile = remoteFile;
    // TODO: compute 65535 from index chunks
    this.header = this.remoteFile.getBytes(0, 65535).then(buf => {
      var decomp = utils.inflateGzip(buf);
      var jb = new jBinary(decomp, bamTypes.TYPE_SET);
      return jb.read('BamHeader');
    });
    this.header.done();

    this.index = remoteIndexFile ? new BaiFile(remoteIndexFile) : null;
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
      var decomp = utils.concatArrayBuffers(utils.inflateConcatenatedGzip(buf));
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
      var blocks = utils.inflateConcatenatedGzip(buf, lastCOffset - start.coffset);
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
        if (chunks.length > 1) {
          throw 'Multi-chunk queries are not implemented';
        }
        var c = chunks[0];
        return this.readChunk(c.chunk_beg, c.chunk_end).then(alignments => {
          return filterAlignments(alignments, idxRange, contained);
        });
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

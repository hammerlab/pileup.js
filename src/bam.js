/**
 * Tools for parsing BAM files.
 * See https://samtools.github.io/hts-specs/SAMv1.pdf
 * @flow
 */
'use strict';

import type * as RemoteFile from './RemoteFile';
import type * as Q from 'q';

var jBinary = require('jbinary'),
    pako = require('pako'),
    _ = require('underscore');

var bamTypes = require('./formats/bamTypes'),
    utils = require('./utils');

/**
 * BAM files are written in "BGZF" format, which consists of many concatenated
 * gzip blocks. gunzip concatenates all the inflated blocks, but pako only
 * inflates one block at a time. This wrapper makes pako behave like gunzip.
 */
function inflateConcatenatedGzip(buffer: ArrayBuffer): ArrayBuffer {
  var position = 0,
      blocks = [],
      inflator;
  do {
    inflator = new pako.Inflate();
    inflator.push(buffer.slice(position));
    if (inflator.err) { throw inflator.msg; }
    if (inflator.result) {
      blocks.push(inflator.result);
    }
    position += inflator.strm.total_in;
  } while (inflator.strm.avail_in > 0);
  return utils.concatArrayBuffers(blocks);
}

/**
 * Inflate a single gzip block at the start of the buffer.
 */
function inflateGzip(buffer: ArrayBuffer): ArrayBuffer {
  return pako.inflate(buffer);
}
 
class Bam {
  header: Q.Promise<Object>;

  constructor(remoteFile: RemoteFile) {
    this.remoteFile = remoteFile;
    // TODO: compute 65535 from index chunks
    this.header = this.remoteFile.getBytes(0, 65535).then(buf => {
      var decomp = inflateGzip(buf);
      var jb = new jBinary(decomp, bamTypes.TYPE_SET);
      return jb.read('BamHeader');
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
      var decomp = inflateConcatenatedGzip(buf);
      var jb = new jBinary(decomp, bamTypes.TYPE_SET);
      var o = jb.read(thinReads ? 'ThinBamFile' : 'BamFile');
      // Do some mild re-shaping.
      o.alignments = o.alignments.map(x => x.contents);
      return o;
    });
  }

  /**
   * Read alignments for a single block.
   */
  readOneBlock(compressedOffset: number, uncompressedOffset: number): Q.Promise<Object> {
    return Q.when(null);
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

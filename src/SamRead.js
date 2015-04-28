/**
 * This class parses and represents a single read in a SAM/BAM file.
 *
 * This is used instead of parsing directly via jBinary in order to:
 * - Make the parsing lazy (for significant performance wins)
 * - Make the resulting object more precisely typed.
 *
 * Parsing reads using SamRead is ~2-3x faster than using jBinary and
 * ThinAlignment directly.
 *
 * @flow
 */
'use strict';

import type * as VirtualOffset from './VirtualOffset';

var jDataView = require('jdataview'),
    jBinary = require('jbinary'),
    _ = require('underscore'),
    {nullString} = require('./formats/helpers'),
    bamTypes = require('./formats/bamTypes'),
    ContigInterval = require('./ContigInterval');

// TODO: Make more extensive use of the jBinary specs.


var CIGAR_OPS = ['M', 'I', 'D', 'N', 'S', 'H', 'P', '=', 'X'];
type CigarOp = {
  op: string;  // M, I, D, N, S, H, P, =, X
  length: number
}

var SEQUENCE_VALUES = ['=', 'A', 'C', 'M', 'G', 'R', 'S', 'V',
                       'T', 'W', 'Y', 'H', 'K', 'D', 'B', 'N'];


class SamRead {
  buffer: ArrayBuffer;
  offset: VirtualOffset;

  pos: number;
  refID: number;
  ref: string;
  l_seq: number;

  // cached values
  _full: ?Object;
  _refLength: ?number;
  _seq: ?string;

  /**
   * @param buffer contains the raw bytes of the serialized BAM read. It must
   *     contain at least one full read (but may contain more).
   * @param offset records where this alignment is located in the BAM file. It's
   *     useful as a unique ID for alignments.
   * @param ref is the human-readable name of the reference/contig (the binary
   *     encoding only contains an ID).
   */
  constructor(buffer: ArrayBuffer, offset: VirtualOffset, ref: string) {
    this.buffer = buffer;
    this.offset = offset;

    // Go ahead and parse a few fields immediately.
    var jv = this._getJDataView();
    this.refID = jv.getInt32(0);
    this.ref = ref;
    this.pos = jv.getInt32(4);
    this.l_seq = jv.getInt32(16);
  }

  toString(): string {
    var stop = this.pos + this.l_seq;
    return `${this.ref}:${1+this.pos}-${stop}`;
  }

  _getJDataView(): jDataView {
    var b = this.buffer;
    return new jDataView(b, 0, b.byteLength, true /* little endian */);
  }

  getName(): string {
    var l_read_name = this._getJDataView().getUint8(8);
    var jb = new jBinary(this.buffer, {
      'jBinary.littleEndian': true
    });
    return jb.read([nullString, l_read_name], 32);
  }

  getFlag(): number {
    return this._getJDataView().getUint16(14);
  }

  // TODO: enum for strand?
  getStrand(): string {
    var reverse = this.getFlag() & 0x10;
    return reverse ? '-' : '+';
  }

  // TODO: get rid of this; move all methods into SamRead.
  getFull(): Object {
    if (this._full) return this._full;
    var jb = new jBinary(this.buffer, bamTypes.TYPE_SET);
    var full = jb.read(bamTypes.ThickAlignment, 0);
    this._full = full;
    return full;
  }

  getInterval(): ContigInterval<string> {
    return new ContigInterval(this.ref,
                              this.pos,
                              this.pos + this.getReferenceLength() - 1);
  }

  intersects(interval: ContigInterval<string>): boolean {
    return interval.intersects(this.getInterval());
  }

  getCigarOps(): CigarOp[] {
    var jv = this._getJDataView(),
        l_read_name = jv.getUint8(8),
        n_cigar_op = jv.getUint16(12),
        pos = 32 + l_read_name,
        ops = new Array(n_cigar_op);
    for (var i = 0; i < n_cigar_op; i++) {
      var v = jv.getUint32(pos + 4 * i);
      ops[i] = {
        op: CIGAR_OPS[v & 0xf],
        length: v >> 4
      };
    }
    return ops;
  }

  getCigarString(): string {
    return makeCigarString(this.getFull().cigar);
  }

  getQualPhred(): string {
    return makeAsciiPhred(this.getFull().qual);
  }

  getSequence(): string {
    if (this._seq) return this._seq;
    var jv = this._getJDataView(),
        l_read_name = jv.getUint8(8),
        n_cigar_op = jv.getUint16(12),
        l_seq = jv.getInt32(16),
        pos = 32 + l_read_name + 4 * n_cigar_op,
        basePairs = new Array(l_seq),
        numBytes = Math.ceil(l_seq / 2);

    for (var i = 0; i < numBytes; i++) {
      var b = jv.getUint8(pos + i);
      basePairs[2 * i] = SEQUENCE_VALUES[b >> 4];
      if (2 * i + 1 < l_seq) {
        basePairs[2 * i + 1] = SEQUENCE_VALUES[b & 0xf];
      }
    }

    var seq = basePairs.join('');
    this._seq = seq;
    return seq;
  }

  // Returns the length of the alignment from first aligned read to last aligned read.
  getReferenceLength(): number {
    if (this._refLength) return this._refLength;
    var refLength = 0;
    this.getCigarOps().forEach(({op, length}) => {
      switch (op) {
        case 'M':
        case 'D':
        case 'N':
        case '=':
        case 'X':
          refLength += length;
      }
    });
    this._refLength = refLength;
    return refLength;
  }

  debugString(): string {
    var f = this.getFull();

    return `Name: ${this.getName()}
FLAG: ${this.getFlag()}
Position: ${this.getInterval()}
CIGAR: ${this.getCigarString()}
Sequence: ${f.seq}
Quality:  ${this.getQualPhred()}
Tags: ${JSON.stringify(f.auxiliary, null, '  ')}
    `;
  }
}

// Convert a structured Cigar object into the string format we all love.
function makeCigarString(cigarOps: Array<{op:string; length:number}>) {
  return cigarOps.map(({op, length}) => length + op).join('');
}

// Convert an array of Phred scores to a printable string.
function makeAsciiPhred(qualities: number[]): string {
  if (qualities.length === 0) return '';
  if (_.every(qualities, x => x == 255)) return '*';
  return qualities.map(q => String.fromCharCode(33 + q)).join('');
}

module.exports = SamRead;

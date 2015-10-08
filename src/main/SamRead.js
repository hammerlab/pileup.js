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
import type {Strand, CigarOp, MateProperties} from './Alignment';

var jDataView = require('jdataview'),
    jBinary = require('jbinary'),
    _ = require('underscore'),
    bamTypes = require('./formats/bamTypes'),
    ContigInterval = require('./ContigInterval');

// TODO: Make more extensive use of the jBinary specs.


var CIGAR_OPS = ['M', 'I', 'D', 'N', 'S', 'H', 'P', '=', 'X'];

var SEQUENCE_VALUES = ['=', 'A', 'C', 'M', 'G', 'R', 'S', 'V',
                       'T', 'W', 'Y', 'H', 'K', 'D', 'B', 'N'];


function strandFlagToString(reverseStrand: number): Strand {
  return reverseStrand ? '-' : '+';
}


class SamRead /* implements Alignment */ {
  buffer: ArrayBuffer;
  offset: VirtualOffset;

  pos: number;
  refID: number;
  ref: string;
  l_seq: number;
  name: string;
  cigarOps: CigarOp[];

  // cached values
  _full: ?Object;
  _seq: ?string;
  _interval: ?ContigInterval<string>;

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
    this.cigarOps = this._getCigarOps();
    this.name = this._getName();
  }

  toString(): string {
    var stop = this.pos + this.l_seq;
    return `${this.ref}:${1+this.pos}-${stop}`;
  }

  _getJDataView(): jDataView {
    var b = this.buffer;
    return new jDataView(b, 0, b.byteLength, true /* little endian */);
  }

  /**
   * Returns an identifier which is unique within the BAM file.
   */
  getKey(): string {
    return this.offset.toString();
  }

  _getName(): string {
    var jv = this._getJDataView();
    var l_read_name = jv.getUint8(8);
    jv.seek(32);  // the read-name starts at byte 32
    return jv.getString(l_read_name - 1);  // ignore null-terminator
  }

  getFlag(): number {
    return this._getJDataView().getUint16(14);
  }

  getStrand(): Strand {
    return strandFlagToString(this.getFlag() & bamTypes.Flags.READ_STRAND);
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
    if (this._interval) return this._interval;  // use the cache
    var interval = new ContigInterval(this.ref,
                                      this.pos,
                                      this.pos + this.getReferenceLength() - 1);
    return interval;
  }

  intersects(interval: ContigInterval<string>): boolean {
    return interval.intersects(this.getInterval());
  }

  _getCigarOps(): CigarOp[] {
    var jv = this._getJDataView(),
        l_read_name = jv.getUint8(8),
        n_cigar_op = jv.getUint16(12),
        pos = 32 + l_read_name,
        cigar_ops = new Array(n_cigar_op);
    for (var i = 0; i < n_cigar_op; i++) {
      var v = jv.getUint32(pos + 4 * i);
      cigar_ops[i] = {
        op: CIGAR_OPS[v & 0xf],
        length: v >> 4
      };
    }
    return cigar_ops;
  }

  /**
   * Returns per-base quality scores from 0-255.
   */
  getQualityScores(): number[] {
    var jv = this._getJDataView(),
        l_read_name = jv.getUint8(8),
        n_cigar_op = jv.getUint16(12),
        l_seq = jv.getInt32(16),
        pos = 32 + l_read_name + 4 * n_cigar_op + Math.ceil(l_seq / 2);
    return jv.getBytes(l_seq, pos, true /* little endian */, true /* toArray */);
  }

  getCigarString(): string {
    return makeCigarString(this.getFull().cigar);
  }

  getQualPhred(): string {
    return makeAsciiPhred(this.getQualityScores());
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
    return SamRead.referenceLengthFromOps(this.cigarOps);
  }

  getMateProperties(): ?MateProperties {
    var jv = this._getJDataView(),
        flag = jv.getUint16(14);
    if (!(flag & bamTypes.Flags.READ_PAIRED)) return null;

    var nextRefId = jv.getInt32(20),
        nextPos = jv.getInt32(24),
        nextStrand = strandFlagToString(flag & bamTypes.Flags.MATE_STRAND);

    return {
      // If the mate is on another contig, there's no easy way to get its string name.
      ref: nextRefId == this.refID ? this.ref : null,
      pos: nextPos,
      strand: nextStrand
    };
  }

  debugString(): string {
    var f = this.getFull();

    return `Name: ${this.name}
FLAG: ${this.getFlag()}
Position: ${this.getInterval()}
CIGAR: ${this.getCigarString()}
Sequence: ${f.seq}
Quality:  ${this.getQualPhred()}
Tags: ${JSON.stringify(f.auxiliary, null, '  ')}
    `;
  }

  static referenceLengthFromOps(ops: CigarOp[]): number {
    var refLength = 0;
    ops.forEach(({op, length}) => {
      switch (op) {
        case 'M':
        case 'D':
        case 'N':
        case '=':
        case 'X':
          refLength += length;
      }
    });
    return refLength;
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

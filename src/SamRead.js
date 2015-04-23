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
    {nullString} = require('./formats/helpers'),
    bamTypes = require('./formats/bamTypes'),
    ContigInterval = require('./ContigInterval');

// TODO: Make more extensive use of the jBinary specs.

class SamRead {
  buffer: ArrayBuffer;
  offset: VirtualOffset;

  pos: number;
  refID: number;
  ref: string;
  l_seq: number;

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
    this.refID = jv.getUint32(0);
    this.ref = ref;
    this.pos = jv.getUint32(4);
    this.l_seq = jv.getUint32(16);
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
    var jb = new jBinary(this.buffer, bamTypes.TYPE_SET);
    return jb.read(bamTypes.ThickAlignment, 0);
  }

  getInterval(): ContigInterval<string> {
    return new ContigInterval(this.ref, this.pos, this.pos + this.l_seq - 1);
  }

  intersects(interval: ContigInterval<string>): boolean {
    return interval.intersects(this.getInterval());
  }
}

module.exports = SamRead;

/**
 * This class parses and represents a single read in a SAM/BAM file.
 *
 * This is used instead of parsing directly via jBinary in order to:
 * - Make the parsing lazy (for significant performance wins)
 * - Make the resulting object more precisely typed.
 *
 * @flow
 */

var jDataView = require('jdataview');
var jBinary = require('jbinary');
var {nullString} = require('./formats/helpers');
var bamTypes = require('./formats/bamTypes');


class SamRead {
  buffer: ArrayBuffer;
  reader: jDataView;

  pos: number;
  refID: number;
  l_seq: number;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;

    // Go ahead and parse a few fields immediately.
    var jv = new jDataView(buffer, 0, buffer.byteLength, true /* little endian */);
    this.refID = jv.getUint32(0);
    this.pos = jv.getUint32(4);
    this.l_seq = jv.getUint32(16);

    this.reader = jv;
  }

  toString(): string {
    var stop = this.pos + this.l_seq;
    return `${this.refID}:${this.pos}-${stop}`;
  }

  getName(): string {
    var l_read_name = this.reader.getUint8(8);
    var jb = new jBinary(this.buffer, {
      'jBinary.littleEndian': true
    });
    return jb.read([nullString, l_read_name], 32);
  }

  // TODO: get rid of this; move all methods into SamRead.
  getFull(): Object {
    var jb = new jBinary(this.buffer, bamTypes.TYPE_SET);
    return jb.read(bamTypes.ThickAlignment, 0);
  }
}

module.exports = SamRead;

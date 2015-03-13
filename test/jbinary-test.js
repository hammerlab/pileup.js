// This is a playground to ensure that I understand how jBinary works.
var chai = require('chai');
var expect = chai.expect;

var jBinary = require('jbinary');

describe('jBinary', function() {
  it('should read two-bit headers', function() {
    var twoBitTypeSet = {
      'jBinary.all': 'File',
      'jBinary.littleEndian': true,
      'File': {
        magic: ['const', 'uint32', 0x1A412743, true],
        version: ['const', 'uint32', 0, true],
        sequenceCount: 'uint32',
        reserved: 'uint32'
      }
    };

    var byteArray = [
        0x43, 0x27, 0x41, 0x1a,
        0x00, 0x00, 0x00, 0x00,
        0x5d, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00];
    var u8array = new Uint8Array(byteArray.length);
    byteArray.forEach((val, idx) => { u8array[idx] = val; });

    var jb = new jBinary(u8array.buffer, twoBitTypeSet);
    var header = jb.readAll();

    expect(header.magic).to.equal(0x1A412743);  // two bit magic
    expect(header.version).to.equal(0);
    expect(header.sequenceCount).to.equal(93);
    expect(header.reserved).to.equal(0);
  });

  it('should advance through a sequence', function() {
    var uint8TypeSet = {
      'jBinary.all': 'File',
      'jBinary.littleEndian': true,
      'File': {
        value: 'uint8'
      }
    };

    var u8array = new Uint8Array(16);
    for (var i = 0; i < 16; i++) {
      u8array[i] = i * i;
    }
    var buffer = u8array.buffer;

    var jb = new jBinary(buffer, uint8TypeSet);
    var num = 0;
    while (jb.tell() < buffer.byteLength) {
      var x = jb.read('File');
      expect(x).to.deep.equal({value: num * num});
      num++;
    }
  });
});

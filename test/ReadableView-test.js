var chai = require('chai');
var expect = chai.expect;

var ReadableView = require('../src/ReadableView');

describe('ReadableView', function() {
  it('should read 8-bit unsigned ints', function() {
    var u8 = new Uint8Array(5);
    u8[0] = 100;
    u8[1] = 255;
    u8[2] = 0;
    u8[3] = 33;
    u8[4] = 127;

    var bytes = new ReadableView(new DataView(u8.buffer));
    expect(bytes.tell()).to.equal(0);
    expect(bytes.bytesRemaining()).to.equal(5);
    expect(bytes.readUint8()).to.equal(100);
    expect(bytes.tell()).to.equal(1);
    expect(bytes.bytesRemaining()).to.equal(4);
    expect(bytes.readUint8()).to.equal(255);
    expect(bytes.readUint8()).to.equal(0);
    expect(bytes.readUint8()).to.equal(33);
    expect(bytes.readUint8()).to.equal(127);
    expect(bytes.bytesRemaining()).to.equal(0);
    expect(bytes.tell()).to.equal(5);
  });

  it('should read strings', function() {
    var u8 = new Uint8Array(6);
    u8[0] = 4;
    u8[1] = '2'.charCodeAt(0);
    u8[2] = 'b'.charCodeAt(0);
    u8[3] = 'i'.charCodeAt(0);
    u8[4] = 't'.charCodeAt(0);
    u8[5] = '?'.charCodeAt(0);

    var bytes = new ReadableView(new DataView(u8.buffer));
    expect(bytes.tell()).to.equal(0);
    expect(bytes.bytesRemaining()).to.equal(6);
    expect(bytes.readUint8()).to.equal(4);
    expect(bytes.readAscii(4)).to.equal('2bit');
    expect(bytes.tell()).to.equal(5);
    expect(bytes.bytesRemaining()).to.equal(1);
    expect(bytes.readAscii(1)).to.equal('?');
    expect(bytes.bytesRemaining()).to.equal(0);
  });

  it('should read uint32 arrays', function() {
    var u32 = new Uint32Array(5);
    u32[0] = 1;
    u32[1] = 2;
    u32[2] = 12345678;
    u32[3] = 1234567890;
    u32[4] = 3;

    var bytes = new ReadableView(new DataView(u32.buffer));
    expect(bytes.tell()).to.equal(0);
    expect(bytes.bytesRemaining()).to.equal(20);
    expect(bytes.readUint32Array(5)).to.deep.equal([1,2,12345678,1234567890,3]);
    expect(bytes.tell()).to.equal(20);
    expect(bytes.bytesRemaining()).to.equal(0);
  });

  it('should read a large uint32', function() {
    var u32 = new Uint32Array(1);
    u32[0] = 0xebf28987;

    var bytes = new ReadableView(new DataView(u32.buffer));
    expect(bytes.readUint32()).to.equal(0xebf28987);
  });
});

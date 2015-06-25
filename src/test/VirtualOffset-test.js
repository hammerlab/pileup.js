/* @flow */
'use strict';

var expect = require('chai').expect;

var jBinary = require('jbinary'),
    bamTypes = require('../main/formats/bamTypes'),
    VirtualOffset = require('../main/VirtualOffset');

describe('VirtualOffset', function() {
  // These test that .fromBlob() is equivalent to jBinary.read('VirtualOffset').
  // They match tests in bai-test.js
  it('should read directly from buffers', function() {
    var u8 = new Uint8Array([201, 121, 79, 100, 96, 92, 1, 0]);
    var vjBinary = new jBinary(u8, bamTypes.TYPE_SET).read('VirtualOffset'),
        vDirect = VirtualOffset.fromBlob(u8);
    expect(vDirect.toString()).to.equal(vjBinary.toString());

    u8 = new Uint8Array([218, 128, 112, 239, 7, 0, 0, 0]);
    vjBinary = new jBinary(u8, bamTypes.TYPE_SET).read('VirtualOffset');
    vDirect = VirtualOffset.fromBlob(u8);
    expect(vDirect.toString()).to.equal(vjBinary.toString());
  });

  it('should read with an offset', function() {
    var base = new Uint8Array(
        [0, 1, 2, 3, 4, 5, 6, 7,
         86, 5, 10, 214, 117, 169, 37, 0,
         86, 5, 10, 214, 117, 169, 37, 0,
         86, 5, 10, 214, 117, 169, 37, 0,
         200, 6, 10, 214, 117, 169, 37, 0]
    );

    var u8 = new Uint8Array(base.buffer, 8);  // this is offset from base

    var vjBinary = new jBinary(u8, bamTypes.TYPE_SET).read('IntervalsArray'),
        vDirect = [
          VirtualOffset.fromBlob(u8, 0),
          VirtualOffset.fromBlob(u8, 8),
          VirtualOffset.fromBlob(u8, 16),
          VirtualOffset.fromBlob(u8, 24)
        ];
    expect(vjBinary).to.have.length(4);
    expect(vDirect[0].toString()).to.equal(vjBinary[0].toString());
    expect(vDirect[1].toString()).to.equal(vjBinary[1].toString());
    expect(vDirect[2].toString()).to.equal(vjBinary[2].toString());
    expect(vDirect[3].toString()).to.equal(vjBinary[3].toString());
  });
});

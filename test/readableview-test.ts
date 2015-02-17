/// <reference path="../typings/chai/chai.d.ts" />
/// <reference path="../typings/mocha/mocha.d.ts" />

import chai = require('chai');
var expect = chai.expect;

import ReadableView = require('../src/readableview');

describe('User Model Unit Tests:', () => {

    describe('2 + 4', () => {
        it('should be 6', () => {
            expect(2+4).to.equals(6);
        });

        it('should not be 7', () => {
            expect(2+4).to.not.equals(7);
        });
    });
});

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
});

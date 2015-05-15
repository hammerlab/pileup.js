/* @flow */
'use strict';

var expect = require('chai').expect;

var pako = require('pako'),
    jBinary = require('jbinary');

var utils = require('../src/utils');

describe('utils', function() {
  describe('tupleLessOrEqual', function() {
    var lessEqual = utils.tupleLessOrEqual;

    it('should work on 1-tuples', function() {
      expect(lessEqual([0], [1])).to.be.true;
      expect(lessEqual([1], [0])).to.be.false;
      expect(lessEqual([0], [0])).to.be.true;
    });

    it('should work on 2-tuples', function() {
      expect(lessEqual([0, 1], [0, 2])).to.be.true;
      expect(lessEqual([0, 1], [0, 0])).to.be.false;
      expect(lessEqual([0, 1], [1, 0])).to.be.true;
    });
  });

  describe('tupleRangeOverlaps', function() {
    var overlap = utils.tupleRangeOverlaps;
    it('should work on 1-tuples', function() {
      var ivs = [
          [[0], [10]],
          [[5], [15]],
          [[-5], [5]],
          [[-5], [4]]
      ];
      var empty = [[4], [3]];
      expect(overlap(ivs[0], ivs[1])).to.be.true;
      expect(overlap(ivs[0], ivs[2])).to.be.true;
      expect(overlap(ivs[1], ivs[3])).to.be.false;

      expect(overlap(ivs[0], empty)).to.be.false;
      expect(overlap(ivs[1], empty)).to.be.false;
      expect(overlap(ivs[2], empty)).to.be.false;
      expect(overlap(ivs[3], empty)).to.be.false;
    });

    it('should work on 2-tuples', function() {
      expect(overlap([[0, 0], [0, 10]],
                     [[0, 5], [0, 15]])).to.be.true;
      expect(overlap([[0, 0], [0, 10]],
                     [[-1, 15], [0, 0]])).to.be.true;
      expect(overlap([[0, 0], [0, 10]],
                     [[-1, 15], [1, -15]])).to.be.true;
      expect(overlap([[0, 0], [0, 10]],
                     [[-1, 15], [0, -1]])).to.be.false;
      expect(overlap([[0, 0], [0, 10]],
                     [[-1, 15], [0, 0]])).to.be.true;
      expect(overlap([[0, 0], [0, 10]],
                     [[0, 10], [0, 11]])).to.be.true;
      expect(overlap([[1, 0], [3, 10]],
                     [[-1, 10], [2, 1]])).to.be.true;
      expect(overlap([[3, 0], [3, 10]],
                     [[-1, 10], [2, 1]])).to.be.false;
    });
  });

  it('should concatenate ArrayBuffers', function() {
    var u8a = new Uint8Array([0, 1, 2, 3]),
        u8b = new Uint8Array([4, 5, 6]),
        concat = new Uint8Array(utils.concatArrayBuffers([u8a.buffer, u8b.buffer]));
    var result = [];
    for (var i = 0; i < concat.byteLength; i++) {
      result.push(concat[i]);
    }
    expect(result).to.deep.equal([0, 1, 2, 3, 4, 5, 6]);
  });

  function bufferToText(buf) {
    return new jBinary(buf).read('string');
  }

  it('should inflate concatenated buffers', function() {
    var str1 = 'Hello World',
        str2 = 'Goodbye, World',
        buf1 = pako.deflate(str1),
        buf2 = pako.deflate(str2),
        merged = utils.concatArrayBuffers([buf1, buf2]);
    expect(buf1.byteLength).to.equal(19);
    expect(buf2.byteLength).to.equal(22);

    var inflated = utils.inflateConcatenatedGzip(merged);
    expect(inflated).to.have.length(2);
    expect(bufferToText(inflated[0].buffer)).to.equal('Hello World');
    expect(bufferToText(inflated[1].buffer)).to.equal('Goodbye, World');

    expect(inflated[0].offset).to.equal(0);
    expect(inflated[0].compressedLength).to.equal(19);
    expect(inflated[1].offset).to.equal(19);
    expect(inflated[1].compressedLength).to.equal(22);

    inflated = utils.inflateConcatenatedGzip(merged, 19);
    expect(inflated).to.have.length(2);
    expect(bufferToText(inflated[0].buffer)).to.equal('Hello World');
    expect(bufferToText(inflated[1].buffer)).to.equal('Goodbye, World');

    inflated = utils.inflateConcatenatedGzip(merged, 18);
    expect(inflated).to.have.length(1);
    expect(bufferToText(inflated[0].buffer)).to.equal('Hello World');

    inflated = utils.inflateConcatenatedGzip(merged, 0);
    expect(inflated).to.have.length(1);
    expect(bufferToText(inflated[0].buffer)).to.equal('Hello World');
  });

  it('should add or remove chr from contig names', function() {
    expect(utils.altContigName('21')).to.equal('chr21');
    expect(utils.altContigName('chr21')).to.equal('21');
    expect(utils.altContigName('M')).to.equal('chrM');
    expect(utils.altContigName('chrM')).to.equal('M');
  });
});

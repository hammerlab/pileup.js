/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;

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
});

/* @flow */
'use strict';

import {expect} from 'chai';

import pako from 'pako';
import jBinary from 'jbinary';

import utils from '../main/utils';
import Interval from '../main/Interval';

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

  describe('scaleRanges', function() {
    // This matches how LocationTrack and PileupTrack define "center".
    function center(iv: Interval) {
      return Math.floor((iv.stop + iv.start) / 2);
    }

    it('should scaleRanges', function() {
      // Zooming in and out should not change the center.
      // See https://github.com/hammerlab/pileup.js/issues/321
      var iv = new Interval(7, 17);
      expect(center(iv)).to.equal(12);
      var iv2 = utils.scaleRange(iv, 0.5);
      expect(center(iv2)).to.equal(12);
      var iv3 = utils.scaleRange(iv2, 2.0);
      expect(center(iv3)).to.equal(12);

      // Zooming in & out once can shift the frame, but doing so repeatedly will
      // not produce any drift or growth/shrinkage.
      var iv4 = iv3.clone();
      for (var i = 0; i < 10; i++) {
        iv4 = utils.scaleRange(iv4, 0.5);
        iv4 = utils.scaleRange(iv4, 2.0);
      }
      expect(iv4.toString()).to.equal(iv3.toString());
    });

    it('should preserve centers', function() {
      function checkCenterThroughZoom(origIv: Interval) {
        var c = center(origIv);
        // Zoom in then out
        var iv = utils.scaleRange(origIv, 0.5);
        expect(center(iv)).to.equal(c);
        iv = utils.scaleRange(iv, 2.0);
        expect(center(iv)).to.equal(c);
        // Zoom out then in
        iv = utils.scaleRange(origIv, 2.0);
        expect(center(iv)).to.equal(c);
        iv = utils.scaleRange(iv, 0.5);
        expect(center(iv)).to.equal(c);
      }

      checkCenterThroughZoom(new Interval(7, 17));
      checkCenterThroughZoom(new Interval(8, 18));
      checkCenterThroughZoom(new Interval(8, 19));
      checkCenterThroughZoom(new Interval(7, 18));
    });

    it('should stay positive', function() {
      var iv = new Interval(5, 25),
          iv2 = utils.scaleRange(iv, 2.0);
      expect(iv2.toString()).to.equal('[0, 40]');
    });
  });

  describe('formatInterval', function() {
    it('should add commas to numbers', function() {
      expect(utils.formatInterval(new Interval(0, 1234))).to.equal('0-1,234');
      expect(utils.formatInterval(new Interval(1234, 567890123))).to.equal('1,234-567,890,123');
    });
  });

  describe('parseRange', function() {
    var parseRange = utils.parseRange;
    it('should parse intervals with and without commas', function() {
      expect(parseRange('1-1234')).to.deep.equal({start: 1, stop: 1234});
      expect(parseRange('1-1,234')).to.deep.equal({start: 1, stop: 1234});
      expect(parseRange('1-1,234')).to.deep.equal({start: 1, stop: 1234});
      expect(parseRange('1,234-567,890,123')).to.deep.equal({start:1234, stop:567890123});
    });

    it('should parse bare contigs', function() {
      expect(parseRange('17:')).to.deep.equal({contig: '17'});
      expect(parseRange('chr17')).to.deep.equal({contig: 'chr17'});
      expect(parseRange('17')).to.deep.equal({start: 17});  // this one is ambiguous
    });

    it('should parse contig + location', function() {
      expect(parseRange('17:1,234')).to.deep.equal({contig: '17', start: 1234});
      expect(parseRange('chrM:1,234,567')).to.deep.equal({contig: 'chrM', start: 1234567});
    });

    it('should parse combined locations', function() {
      expect(parseRange('17:1,234-5,678')).to.deep.equal(
          {contig: '17', start: 1234, stop: 5678});
    });

    it('should return null for invalid ranges', function() {
      expect(parseRange('::')).to.be.null;
    });
  });

  it('should flatMap', function() {
    expect(utils.flatMap([1, 2, 3], x => [x])).to.deep.equal([1, 2, 3]);
    expect(utils.flatMap([1, 2, 3], x => x % 2 === 0 ? [x, x] : [])).to.deep.equal([2, 2]);

    expect(utils.flatMap([[1,2], [2,3]], a => a)).to.deep.equal([1, 2, 2, 3]);
    expect(utils.flatMap([[1,2], [2,3]], a => [a])).to.deep.equal([[1, 2], [2, 3]]);
  });

  it('should compute percentiles', function() {
    //            75  50   25
    var xs = [7, 6, 5, 4, 3, 2, 1];
    expect(utils.computePercentile(xs, 50)).to.equal(4);  // median
    expect(utils.computePercentile(xs, 25)).to.equal(2.5);
    expect(utils.computePercentile(xs, 75)).to.equal(5.5);

    // javascript sorting is lexicographic by default.
    expect(utils.computePercentile([9, 55, 456, 3210], 100)).to.equal(3210);

    // pathological cases
    expect(utils.computePercentile([1], 99)).to.equal(1);
    expect(utils.computePercentile([], 99)).to.equal(0);
  });
});

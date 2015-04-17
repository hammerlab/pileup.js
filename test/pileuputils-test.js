/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;

var _ = require('underscore');

var {pileup} = require('../src/pileuputils'),
    Interval = require('../src/Interval');

describe('pileuputils', function() {
  // This checks that pileup's guarantee is met.
  function checkGuarantee(reads: Interval[], rows: number[]) {
    var readsByRow = _.groupBy(reads, (read, i) => rows[i]);
    _.each(readsByRow, reads => {
      // No pair of reads in the same row should intersect.
      for (var i = 0; i < reads.length - 1; i++) {
        for (var j = i + 1; j < reads.length; j++) {
          expect(reads[i].intersects(reads[j])).to.be.false;
        }
      }
    });
  }

  it('should check the guarantee', function() {
    var reads = [
      new Interval(0, 9),
      new Interval(5, 14),
      new Interval(10, 19),
    ];
    checkGuarantee(reads, [0, 1, 2]);  // ok
    checkGuarantee(reads, [0, 1, 0]);  // ok
    expect(() => checkGuarantee(reads, [0, 0, 0])).to.throw();  // not ok
  });

  it('should pile up a collection of reads', function() {
    var reads = [
      new Interval(0, 9),
      new Interval(5, 14),
      new Interval(10, 19),
      new Interval(15, 24)
    ];
    var rows = pileup(reads);
    checkGuarantee(reads, rows);
    expect(rows).to.deep.equal([0,1,0,1]);
  });

  it('should pile up a deep collection of reads', function() {
    var reads = [
      new Interval(0, 9),
      new Interval(1, 10),
      new Interval(2, 11),
      new Interval(3, 12),
      new Interval(4, 13)
    ];
    var rows = pileup(reads);
    checkGuarantee(reads, rows);
    expect(rows).to.deep.equal([0,1,2,3,4]);
  });

  it('should pile up around a long read', function() {
    var reads = [
      new Interval(1, 9),
      new Interval(0, 100),
      new Interval(5, 14),
      new Interval(10, 19),
      new Interval(15, 24)
    ];
    var rows = pileup(reads);
    checkGuarantee(reads, rows);
    expect(rows).to.deep.equal([0,1,2,0,2]);
  });
});

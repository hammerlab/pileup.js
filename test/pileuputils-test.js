/* @flow */
'use strict';

var expect = require('chai').expect;

var _ = require('underscore');

var {pileup, addToPileup, getDifferingBasePairs} = require('../src/pileuputils'),
    Interval = require('../src/Interval'),
    Bam = require('../src/bam'),
    RemoteFile = require('../src/RemoteFile');

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

  it('should build a pileup progressively', function() {
    var reads = [
      new Interval(1, 9),
      new Interval(0, 100),
      new Interval(5, 14),
      new Interval(10, 19),
      new Interval(15, 24)
    ];
    var pileup = [];
    var rows = reads.map(read => addToPileup(read, pileup));
    checkGuarantee(reads, rows);
    expect(rows).to.deep.equal([0,1,2,0,2]);
  });

  function getSamArray(url) {
    return new Bam(new RemoteFile(url)).readAll().then(d => d.alignments);
  }

  it('should find differences between ref and read', function() {
    return getSamArray('/test/data/test_input_1_a.bam').then(reads => {
      var read = reads[0];
      expect(read.pos).to.equal(49);
      expect(read.getCigarString()).to.equal('10M');
      //                                   0123456789
      expect(read.getSequence()).to.equal('ATTTAGCTAC');
      var ref =                           'TTTTAGCGAC';

      expect(getDifferingBasePairs(read, ref)).to.deep.equal([
        {pos: 49+0, basePair: 'A'},
        {pos: 49+7, basePair: 'T'}
      ]);

      // More complex CIGAR strings are not supported yet.
      var read3 = reads[3];
      expect(read3.getCigarString()).to.equal('1S2I6M1P1I1P1I4M2I');
      expect(getDifferingBasePairs(read3, ref)).to.deep.equal([]);
    });
  });
});

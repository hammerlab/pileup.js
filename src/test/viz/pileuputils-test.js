/* @flow */
'use strict';

import type SamRead from '../../main/data/SamRead';

import {expect} from 'chai';
import _ from 'underscore';

import {pileup, addToPileup,  getOpInfo} from '../../main/viz/pileuputils';
import Interval from '../../main/Interval';
import ContigInterval from '../../main/ContigInterval';
import Bam from '../../main/data/bam';
import RemoteFile from '../../main/RemoteFile';

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

  it('should check the guarantee', function(done) {
    var reads = [
      new Interval(0, 9),
      new Interval(5, 14),
      new Interval(10, 19),
    ];
    checkGuarantee(reads, [0, 1, 2]);  // ok
    checkGuarantee(reads, [0, 1, 0]);  // ok
    expect(() => checkGuarantee(reads, [0, 0, 0])).to.throw();  // not ok
    done();
  });

  it('should pile up a collection of reads', function(done) {
    var reads = [
      new Interval(0, 9),
      new Interval(5, 14),
      new Interval(10, 19),
      new Interval(15, 24)
    ];
    var rows = pileup(reads);
    checkGuarantee(reads, rows);
    expect(rows).to.deep.equal([0,1,0,1]);
    done();
  });

  it('should pile up a deep collection of reads', function(done) {
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
    done();
  });

  it('should pile up around a long read', function(done) {
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
    done();
  });

  it('should build a pileup progressively', function(done) {
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
    done();
  });

  var ref =  // chr17:7513000-7513500
    "CCTTTTGGGTTCTTCCCTTAGCTCCTGCTCAAGTGTCCTCCCCACTCCCACAACCACTAATATTTTATCCA" +
    "TTCCCTCTTCTTTTCCCTGTAATCCCAACACTTGGAGGCCGAGGTCGGTAGATCAGCTGAGGCCAGGAGTT" +
    "CGAGACCAGTCTGGCCAATATGGCAAAACCCCATTGCTACTATATATATATGTATACATATACATATATAT" +
    "ACACATACATATATATGTATATATACATGTATATGTATATATATACATGTATATGTATACATATATATACA" +
    "TGTATATGTATACATATATATATACATGTATATGTATACATATATATATACATGTATATGTATACATGTAT" +
    "GTATATATATACACACACACACACACACATATATATAAATTAGCCAGGCGTGGTGGCACATGGCTGTAACC" +
    "TCAGCTATTCAGGGTGGCTGAGATATGAGAATCACTTGAAGCCAGGAGGCAGAGGCTGCAGGGTCGTCTGG" +
    "ATTT";
  it('should split reads into ops', function(): any {
    var bamFile = new RemoteFile('/test-data/synth3.normal.17.7500000-7515000.bam'),
        bamIndexFile = new RemoteFile('/test-data/synth3.normal.17.7500000-7515000.bam.bai'),
        bam = new Bam(bamFile, bamIndexFile);

    var range = new ContigInterval('chr17', 7513106, 7513400);

    var fakeReferenceSource = {
      getRangeAsString: function({contig,start,stop}) {
        expect(contig).to.equal('17');
        expect(start).to.be.within(7513000, 7513500);
        expect(stop).to.be.within(7513000, 7513500);
        return ref.slice(start - 7513000, stop - 7513000 + 1);
      }
    };

    var unknownReferenceSource = {
      getRangeAsString: function({start, stop}) {
        return _.range(start, stop + 1).map(x => '.').join('');
      }
    };

    return bam.getAlignmentsInRange(range).then(reads => {
      var findRead = function(startPos): SamRead {
        var r = null;
        for (var i = 0; i < reads.length; i++) {
          if (reads[i].pos == startPos) {
            expect(r).to.be.null;  // duplicate read
            r = reads[i];
          }
        }
        if (r) return r;
        throw `Unable to find read starting at position ${startPos}`;
      };

      var simpleMismatch = findRead(7513223 - 1),
          deleteRead = findRead(7513329 - 1),
          insertRead = findRead(7513205 - 1),
          softClipRead = findRead(7513109 - 1);

      expect(simpleMismatch.getCigarString()).to.equal('101M');
      expect(deleteRead.getCigarString()).to.equal('37M4D64M');
      expect(insertRead.getCigarString()).to.equal('73M20I8M');
      expect(softClipRead.getCigarString()).to.equal('66S35M');

      expect(getOpInfo(simpleMismatch, fakeReferenceSource)).to.deep.equal({
        ops: [
          { op: 'M', length: 101, pos: 7513222, arrow: 'R' }
        ],
        mismatches: [{pos: 7513272, basePair: 'G', quality: 1}]
      });

      expect(getOpInfo(deleteRead, fakeReferenceSource)).to.deep.equal({
        ops: [
          { op: 'M', length: 37, pos: 7513328 + 0,  arrow: null },
          { op: 'D', length:  4, pos: 7513328 + 37, arrow: null },
          { op: 'M', length: 64, pos: 7513328 + 41, arrow: 'R' }
        ],
        mismatches: []
      });

      expect(getOpInfo(insertRead, fakeReferenceSource)).to.deep.equal({
        ops: [
          { op: 'M', length: 73, pos: 7513204 + 0,  arrow: 'L' },
          { op: 'I', length: 20, pos: 7513204 + 73, arrow: null },
          { op: 'M', length:  8, pos: 7513204 + 73, arrow: null }
        ],
        mismatches: []
      });

      expect(getOpInfo(softClipRead, fakeReferenceSource)).to.deep.equal({
          ops: [
            { op: 'S', length: 66, pos: 7513108 + 0, arrow: null },
            { op: 'M', length: 35, pos: 7513108 + 0, arrow: 'L' }
          ],
          mismatches: [
            { pos: 7513109, basePair: 'G', quality: 2 },
            { pos: 7513112, basePair: 'C', quality: 2 }
          ]
        });

      expect(getOpInfo(simpleMismatch, unknownReferenceSource)).to.deep.equal({
        ops: [
          { op: 'M', length: 101, pos: 7513222, arrow: 'R' }
        ],
        mismatches: []  // no mismatches against unknown reference data
      });
    });
  });
});

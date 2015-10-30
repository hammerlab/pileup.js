/* @flow */
'use strict';

var expect = require('chai').expect;

require('chai').config.truncateThreshold = 0; // disable truncating

var _ = require('underscore');

var {pileup, addToPileup,  getOpInfo, getNewTileRanges} = require('../main/pileuputils'),
    Interval = require('../main/Interval'),
    ContigInterval = require('../main/ContigInterval'),
    Bam = require('../main/bam'),
    RemoteFile = require('../main/RemoteFile');

import type * as SamRead from '../main/SamRead';

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

  var ref =  // chr17:7513000-7513500
    "CCTTTTGGGTTCTTCCCTTAGCTCCTGCTCAAGTGTCCTCCCCACTCCCACAACCACTAATATTTTATCCA" +
    "TTCCCTCTTCTTTTCCCTGTAATCCCAACACTTGGAGGCCGAGGTCGGTAGATCAGCTGAGGCCAGGAGTT" +
    "CGAGACCAGTCTGGCCAATATGGCAAAACCCCATTGCTACTATATATATATGTATACATATACATATATAT" +
    "ACACATACATATATATGTATATATACATGTATATGTATATATATACATGTATATGTATACATATATATACA" +
    "TGTATATGTATACATATATATATACATGTATATGTATACATATATATATACATGTATATGTATACATGTAT" +
    "GTATATATATACACACACACACACACACATATATATAAATTAGCCAGGCGTGGTGGCACATGGCTGTAACC" +
    "TCAGCTATTCAGGGTGGCTGAGATATGAGAATCACTTGAAGCCAGGAGGCAGAGGCTGCAGGGTCGTCTGG" +
    "ATTT";
  it('should split reads into ops', function() {
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

  describe('getNewTileRanges', function() {
    var iv = (a, b) => new Interval(a, b);

    it('should tile new ranges', function() {
      // The 0-100bp range gets enlarged & covered by a 0-500bp buffer.
      expect(getNewTileRanges([], iv(0, 100), 1))
          .to.deep.equal([iv(0, 499)]);

      // A large range requires multiple buffers.
      expect(getNewTileRanges([], iv(0, 800), 1))
          .to.deep.equal([iv(  0, 499),
                          iv(500, 999)]);

      // A gap gets filled.
      expect(getNewTileRanges([iv(0, 200), iv(400, 800)], iv(0, 800), 1))
          .to.deep.equal([iv(201, 399)]);

      // There's an existing tile in the middle of the new range.
      expect(getNewTileRanges([iv(0, 200), iv(400, 700)], iv(350, 750), 1))
          .to.deep.equal([iv(201, 399), iv(701, 999)]);
    });

    function intervalsAfterPanning(seq: Interval[], pxPerBase: number): Interval[] {
      var tiles = [];
      seq.forEach(range => {
        tiles = tiles.concat(getNewTileRanges(tiles, range, pxPerBase));
        tiles = _.sortBy(tiles, iv => iv.start);
      });
      return tiles;
    }

    it('should generate a small number of tiles while panning', function() {
      // This simulates a sequence of views that might result from panning.
      // Start at [100, 500], pan to the left, then over to the right.
      expect(intervalsAfterPanning(
            [iv(100, 500),
             iv( 95, 495),
             iv( 85, 485),
             iv( 75, 475),
             iv( 15, 415),
             iv( 70, 470),
             iv(101, 501),
             iv(110, 510),
             iv(120, 520),
             iv(600, 1000),
             iv(610, 1010)], 1))
          .to.deep.equal([iv(0, 499), iv(500, 999), iv(1000, 1499)]);
    });

    it('should not leave gaps with non-integer pixels per base', function() {
      var pxPerBase = 1100 / 181;  // ~6.077 px/bp -- very awkward!
      expect(intervalsAfterPanning(
            [iv(100, 300),
             iv( 95, 295),
             iv( 85, 285),
             iv( 75, 275),
             iv( 15, 215),
             iv( 70, 270),
             iv(101, 301),
             iv(110, 310),
             iv(120, 320),
             iv(600, 800),
             iv(610, 810)], pxPerBase))
          .to.deep.equal([
              // These tiles are somewhat arbitrary.
              // What's important is that they're integers with no gaps.
              iv(  0, 82),
              iv( 83, 165),
              iv(166, 248),
              iv(249, 331),
              iv(581, 663),
              iv(664, 746),
              iv(747, 829)
            ]);
    });
  });
});

/**
 * @flow
 */
'use strict';

import type {Alignment, CigarOp, MateProperties, Strand} from '../../main/Alignment';

import {expect} from 'chai';
import _ from 'underscore';

import PileupCache from '../../main/viz/PileupCache';
import ContigInterval from '../../main/ContigInterval';
import Bam from '../../main/data/bam';
import RemoteFile from '../../main/RemoteFile';
import {makeRead, makeReadPair, fakeSource} from '../FakeAlignment';


describe('PileupCache', function() {
  function ci(chr: string, start: number, end:number) {
    return new ContigInterval(chr, start, end);
  }

  function makeCache(args, viewAsPairs: boolean) {
    var cache = new PileupCache(fakeSource, viewAsPairs);
    _.flatten(args).forEach(read => cache.addAlignment(read));
    return cache;
  }

  it('should group read pairs', function() {
    var cache = makeCache(makeReadPair(ci('chr1', 100, 200),
                                       ci('chr1', 300, 400)), true /* viewAsPairs */);

    var groups = _.values(cache.groups);
    expect(groups).to.have.length(1);
    var g = groups[0];
    expect(g.row).to.equal(0);
    expect(g.insert).to.not.be.null;
    if (!g.insert) return;  // for flow
    expect(g.insert.toString()).to.equal('[200, 300]');
    expect(g.alignments).to.have.length(2);
    expect(g.alignments[0].read.getInterval().toString()).to.equal('chr1:100-200');
    expect(g.alignments[1].read.getInterval().toString()).to.equal('chr1:300-400');
    expect(g.span.toString()).to.equal('chr1:100-400');
    expect(cache.pileupHeightForRef('chr1')).to.equal(1);
    expect(cache.pileupHeightForRef('chr2')).to.equal(0);
  });

  it('should group pile up pairs', function() {
    // A & B overlap, B & C overlap, but A & C do not. So two rows will suffice.
    var cache = makeCache([
      makeReadPair(ci('chr1', 100, 200), ci('chr1', 300, 400)),  // A
      makeReadPair(ci('chr1', 300, 400), ci('chr1', 500, 600)),  // B
      makeReadPair(ci('chr1', 700, 800), ci('chr1', 500, 600))   // C
    ], true /* viewAsPairs */);

    var groups = _.values(cache.groups);
    expect(groups).to.have.length(3);
    expect(groups[0].row).to.equal(0);
    expect(groups[1].row).to.equal(1);
    expect(groups[2].row).to.equal(0);
    expect(cache.pileupHeightForRef('chr1')).to.equal(2);
  });

  it('should pile pairs which overlap only in their inserts', function() {
    // No individual reads overlap, but they do when their inserts are included.
    var cache = makeCache([
      makeReadPair(ci('chr1', 100, 200), ci('chr1', 800, 900)),
      makeReadPair(ci('chr1', 300, 400), ci('chr1', 500, 600))
    ], true /* viewAsPairs */);

    var groups = _.values(cache.groups);
    expect(groups).to.have.length(2);
    expect(groups[0].row).to.equal(0);
    expect(groups[1].row).to.equal(1);
    expect(cache.pileupHeightForRef('chr1')).to.equal(2);
  });

  it('should pack unpaired reads more tightly', function() {
    // Same as the previous test, but with viewAsPairs = false.
    // When the inserts aren't rendered, the reads all fit on a single line.
    var cache = makeCache([
      makeReadPair(ci('chr1', 100, 200), ci('chr1', 800, 900)),
      makeReadPair(ci('chr1', 300, 400), ci('chr1', 500, 600))
    ], false /* viewAsPairs */);
    var groups = _.values(cache.groups);
    expect(groups).to.have.length(4);
    expect(cache.pileupHeightForRef('chr1')).to.equal(1);
  });

  it('should separate pairs on differing contigs', function() {
    var cache = makeCache(makeReadPair(ci('chr1', 100, 200),
                                       ci('chr2', 150, 250)), true /* viewAsPairs */);

    var groups = _.values(cache.groups);
    expect(groups).to.have.length(2);
    expect(groups[0].row).to.equal(0);
    expect(groups[1].row).to.equal(0);
    expect(groups[0].alignments).to.have.length(1);
    expect(groups[1].alignments).to.have.length(1);
    expect(groups[0].insert).to.be.null;
    expect(groups[1].insert).to.be.null;
    expect(cache.pileupHeightForRef('chr1')).to.equal(1);
    expect(cache.pileupHeightForRef('chr2')).to.equal(1);
    expect(cache.pileupHeightForRef('1')).to.equal(1);
    expect(cache.pileupHeightForRef('2')).to.equal(1);
  });

  it('should find overlapping reads', function() {
    var cache = makeCache([
      makeReadPair(ci('chr1', 100, 200), ci('chr1', 800, 900)),
      makeReadPair(ci('chr1', 300, 400), ci('chr1', 500, 600)),
      makeReadPair(ci('chr2', 100, 200), ci('chr2', 300, 400))
    ], true /* viewAsPairs */);

    expect(cache.getGroupsOverlapping(ci('chr1', 50, 150))).to.have.length(1);
    expect(cache.getGroupsOverlapping(ci('chr1', 50, 350))).to.have.length(2);
    expect(cache.getGroupsOverlapping(ci('chr1', 300, 400))).to.have.length(2);
    expect(cache.getGroupsOverlapping(ci('chr1', 850, 950))).to.have.length(1);
    expect(cache.getGroupsOverlapping(ci('chr1', 901, 950))).to.have.length(0);
    expect(cache.getGroupsOverlapping(ci('chr2', 50, 150))).to.have.length(1);
    expect(cache.getGroupsOverlapping(ci('chr2', 250, 260))).to.have.length(1);
    expect(cache.getGroupsOverlapping(ci('chr3', 250, 260))).to.have.length(0);

    // 'chr'-tolerance
    expect(cache.getGroupsOverlapping(ci('1', 50, 150))).to.have.length(1);
    expect(cache.getGroupsOverlapping(ci('1', 50, 350))).to.have.length(2);
  });

  it('should sort reads at a locus', function() {
    var read = (start, stop) => makeRead(ci('chr1', start, stop), '+');
    var cache = makeCache([
      read(100, 200),
      read(150, 250),
      read(200, 300),
      read(250, 350)
    ], false /* viewAsPairs */);
    expect(cache.pileupHeightForRef('chr1')).to.equal(3);

    var formatReads = g => [g.row, g.span.toString()];

    expect(cache.getGroupsOverlapping(ci('chr1', 0, 500))
                .map(formatReads)).to.deep.equal([
      [0, 'chr1:100-200'],
      [1, 'chr1:150-250'],
      [2, 'chr1:200-300'],
      [0, 'chr1:250-350']
    ]);

    cache.sortReadsAt('1', 275);  // note 'chr'-tolerance
    expect(cache.getGroupsOverlapping(ci('chr1', 0, 500))
                .map(formatReads)).to.deep.equal([
      [1, 'chr1:100-200'],
      [2, 'chr1:150-250'],
      [0, 'chr1:200-300'],  // these last two reads are now on top
      [1, 'chr1:250-350']
    ]);

    // reads on another contig should not be affected by sorting.
    cache.addAlignment(makeRead(ci('chr2', 0, 100), '+'));
    cache.addAlignment(makeRead(ci('chr2', 50, 150), '+'));
    cache.addAlignment(makeRead(ci('chr2', 100, 200), '+'));
    expect(cache.getGroupsOverlapping(ci('chr2', 0, 500))
                .map(formatReads)).to.deep.equal([
      [0, 'chr2:0-100'],
      [1, 'chr2:50-150'],
      [2, 'chr2:100-200']
    ]);

    cache.sortReadsAt('chr1', 150);
    expect(cache.getGroupsOverlapping(ci('chr1', 0, 500))
                .map(formatReads)).to.deep.equal([
      [0, 'chr1:100-200'],
      [1, 'chr1:150-250'],
      [2, 'chr1:200-300'],
      [0, 'chr1:250-350']
    ]);
    expect(cache.getGroupsOverlapping(ci('chr2', 0, 500))
                .map(formatReads)).to.deep.equal([
      [0, 'chr2:0-100'],
      [1, 'chr2:50-150'],
      [2, 'chr2:100-200']
    ]);
  });

  it('should sort paired reads at a locus', function() {
    var cache = makeCache([
      makeReadPair(ci('chr1', 100, 200), ci('chr1', 800, 900)),
      makeReadPair(ci('chr1', 300, 400), ci('chr1', 500, 600))
    ], true /* viewAsPairs */);


    var groups = _.values(cache.groups);
    expect(groups).to.have.length(2);

    var rows = () => groups.map(g => g.row);
    expect(rows()).to.deep.equal([0, 1]);
    expect(cache.pileupHeightForRef('chr1')).to.equal(2);

    // While both groups overlap this locus when you include the insert, only
    // the second group has a read which overlaps it.
    cache.sortReadsAt('chr1', 350);
    expect(rows()).to.deep.equal([1, 0]);

    cache.sortReadsAt('chr1', 850);
    expect(rows()).to.deep.equal([0, 1]);
  });

  it('should sort a larger pileup of pairs', function() {
    // A:   <---        --->
    // B:        <---  --->
    // C:      <---   --->
    // x          |
    // (x intersects reads on B&C but only the insert on A)
    var cache = makeCache([
      makeReadPair(ci('chr1', 100, 200), ci('chr1', 600, 700)),  // A
      makeReadPair(ci('chr1', 300, 400), ci('chr1', 550, 650)),  // B
      makeReadPair(ci('chr1', 250, 350), ci('chr1', 500, 600))   // C
    ], true /* viewAsPairs */);

    var groups = _.values(cache.groups);
    var rows = () => groups.map(g => g.row);
    expect(rows()).to.deep.equal([0, 1, 2]);

    cache.sortReadsAt('chr1', 325);  // x
    expect(rows()).to.deep.equal([2, 1, 0]);
  });

  it('should compute statistics on a BAM file', function() {
    this.timeout(5000);
    var bam = new Bam(
        new RemoteFile('/test-data/synth4.tumor.1.4930000-4950000.bam'),
        new RemoteFile('/test-data/synth4.tumor.1.4930000-4950000.bam.bai'));
    return bam.getAlignmentsInRange(ci('chr1', 4930382, 4946898)).then(reads => {
      expect(reads).to.have.length.above(1000);
      var cache = makeCache(reads, true /* viewAsPairs */);
      var stats = cache.getInsertStats();
      expect(stats.minOutlierSize).to.be.within(1, 100);
      expect(stats.maxOutlierSize).to.be.within(500, 600);
    });
  });

  // TODO:
  // - a mate with an insertion or deletion
  // - unpaired reads
});

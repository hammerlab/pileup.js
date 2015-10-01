/**
 * @flow
 */
'use strict';

import type {Alignment, CigarOp, MateProperties, Strand} from '../main/Alignment';

var expect = require('chai').expect;
var _ = require('underscore');

var PileupCache = require('../main/PileupCache'),
    ContigInterval = require('../main/ContigInterval'),
    Interval = require('../main/Interval');

var numAlignments = 1;
class TestAlignment /* implements Alignment */ {
  pos: number;
  ref: string;
  key: string;
  interval: ContigInterval<string>;
  mateProps: ?MateProperties;
  name: string;
  strand: Strand;
  cigarOps: CigarOp[];

  constructor(interval: ContigInterval<string>, name: string, strand: Strand, mateProps: ?MateProperties) {
    this.interval = interval;
    this.ref = interval.contig;
    this.pos = interval.start();
    this.name = name;
    this.strand = strand;
    this.key = 'align:' + (numAlignments++);
    this.mateProps = mateProps;
    this.cigarOps = [];
  }

  getKey(): string { return this.key; }
  getStrand(): Strand { return this.strand; }
  getQualityScores(): number[] { return []; }
  getSequence(): string { return ''; }
  getInterval(): ContigInterval<string> { return this.interval; }
  getReferenceLength(): number { return this.interval.length(); }
  getMateProperties(): ?MateProperties { return this.mateProps; }

  intersects(interval: ContigInterval<string>): boolean {
    return interval.intersects(this.getInterval());
  }
}

var nameCounter = 1;
function makeReadPair(range1: ContigInterval<string>, range2: ContigInterval<string>): Alignment[] {
  var name = 'group:' + (nameCounter++);
  return [
    new TestAlignment(range1, name, '+', {ref: range2.contig, pos: range2.start(), strand: '-' }),
    new TestAlignment(range2, name, '-', {ref: range1.contig, pos: range1.start(), strand: '+' })
  ];
}

function makeUnpairedRead(range: ContigInterval<string>, strand: Strand): Alignment {
  var name = 'group:' + (nameCounter++);
  return new TestAlignment(range, name, strand, null);
}

function dieFn() { throw 'Should not have called this.'; }
var fakeSource = {
  rangeChanged: dieFn,
  getRange: function() { return {}; },
  getRangeAsString: function() { return ''; },
  contigList: function() { return []; },
  normalizeRange: function() { },
  on: dieFn,
  off: dieFn,
  once: dieFn,
  trigger: dieFn
};

describe('PileupCache', function() {
  function ci(...x: any) { return new ContigInterval(...x); }

  function makeCache(args) {
    var cache = new PileupCache(fakeSource);
    _.flatten(args).forEach(read => cache.addAlignment(read));
    return cache;
  }

  it('should group read pairs', function() {
    var cache = makeCache(makeReadPair(ci('chr1', 100, 200),
                                       ci('chr1', 300, 400)));

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
    ]);

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
    ]);

    var groups = _.values(cache.groups);
    expect(groups).to.have.length(2);
    expect(groups[0].row).to.equal(0);
    expect(groups[1].row).to.equal(1);
    expect(cache.pileupHeightForRef('chr1')).to.equal(2);
  });

  it('should separate pairs on differing contigs', function() {
    var cache = makeCache(makeReadPair(ci('chr1', 100, 200),
                                       ci('chr2', 150, 250)));

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
    ]);

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

  // TODO:
  // - a mate with an insertion or deletion
  // - unpaired reads
});

/**
 * A simple implementation of Alignment which doesn't require network accesses.
 * @flow
 */
'use strict';

import type {Alignment, CigarOp, MateProperties, Strand} from '../main/Alignment';
import type ContigInterval from '../main/ContigInterval';
import Q from 'q';
import type {GenomeRange} from '../main/types';

var numAlignments = 1;
class FakeAlignment /* implements Alignment */ {
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
  getInferredInsertSize(): number { return 0; }
}

var nameCounter = 1;
function makeReadPair(range1: ContigInterval<string>, range2: ContigInterval<string>): Alignment[] {
  var name = 'group:' + (nameCounter++);
  return [
    new FakeAlignment(range1, name, '+', {ref: range2.contig, pos: range2.start(), strand: '-' }),
    new FakeAlignment(range2, name, '-', {ref: range1.contig, pos: range1.start(), strand: '+' })
  ];
}

function makeRead(range: ContigInterval<string>, strand: Strand): Alignment {
  var name = 'read:' + (nameCounter++);
  return new FakeAlignment(range, name, strand);
}


function dieFn(): void { throw 'Should not have called this.'; }
var fakeSource = {
  rangeChanged: dieFn,
  getRange: function(): any { return {}; },
  getRangeAsString: function(): string { return ''; },
  contigList: function(): string[] { return []; },
  normalizeRange: function(range: GenomeRange): Q.Promise<GenomeRange> { return Q.when(range); },
  on: dieFn,
  off: dieFn,
  once: dieFn,
  trigger: dieFn
};


module.exports = {
  FakeAlignment,
  makeRead,
  makeReadPair,
  fakeSource,
};

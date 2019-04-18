/**
 * Data management for CoverageTrack.
 *
 * This class tracks counts and mismatches at each locus.
 *
 * @flow
 */
'use strict';

import type {Alignment} from '../Alignment';
import Feature from '../data/feature';
import type {TwoBitSource} from '../sources/TwoBitDataSource';
import type ContigInterval from '../ContigInterval';
import type {CoverageCount} from './pileuputils';
import utils from '../utils';

export type BinSummary = {
  count: number;
  // These properties will only be present when there are mismatches.
  mismatches?: {[key: string]: number};
  ref?: string;  // what does the reference have here?
};

// This class provides data management for the visualization, grouping paired
// reads and managing the pileup.
class CoverageCache<T: (Alignment | Feature)> {
  // maps groupKey to VisualGroup
  items: {[key: string]: T};
  // ref --> position --> BinSummary
  refToCounts: {[key: string]: {[key: number]: BinSummary}};
  refToMaxCoverage: {[key: string]: number};
  referenceSource: TwoBitSource;

  constructor(referenceSource: TwoBitSource) {
    this.items = {};
    this.refToCounts = {};
    this.refToMaxCoverage = {};
    this.referenceSource = referenceSource;
  }

  // Load a new read into the visualization cache.
  // Calling this multiple times with the same read is a no-op.
  addItem(item: T) {
    var key = item.getKey();
    if (key in this.items) return;  // we've already seen this one.
    this.items[key] = item;
    var coverageCount = item.getCoverage(this.referenceSource);
    this.addToCoverage(coverageCount);
  }

  // Updates reference mismatch information for previously-loaded reads.
  updateMismatches(range: ContigInterval<string>) {
    var ref = this._canonicalRef(range.contig);
    this.refToCounts[ref] = {};  // TODO: could be more efficient
    this.refToMaxCoverage[ref] = 0;

    for (var k in this.items) {
      var item: (Feature | Alignment) = this.items[k];
      if (item.getInterval().chrOnContig(range.contig)) {
        var coverageCount = item.getCoverage(this.referenceSource);
        this.addToCoverage(coverageCount);
      }
    }
  }

  addToCoverage(coverageCount: CoverageCount) {

    // Add coverage/mismatch information
    var ref = this._canonicalRef(coverageCount.range.contig);
    if (!(ref in this.refToCounts)) {
      this.refToCounts[ref] = {};
      this.refToMaxCoverage[ref] = 0;
    }
    var counts = this.refToCounts[ref],
        max = this.refToMaxCoverage[ref],
        contig = coverageCount.range,
        start = contig.start(),
        stop = contig.stop();
    for (var pos = start; pos <= stop; pos++) {
      let c = counts[pos];
      if (!c) {
        counts[pos] = c = {count: 0};
      }
      c.count += 1;
      if (c.count > max) max = c.count;
    }

    if (coverageCount.opInfo) {
      for (var mm of coverageCount.opInfo.mismatches) {
        var bin = counts[mm.pos];
        var mismatches;
        if (bin.mismatches) {
          mismatches = bin.mismatches;
        } else {
          mismatches = bin.mismatches = {};
          bin.ref = this.referenceSource.getRangeAsString({
            contig: ref, start: mm.pos, stop: mm.pos});
        }
        let c = mismatches[mm.basePair] || 0;
        mismatches[mm.basePair] = 1 + c;
      }
    }
    this.refToMaxCoverage[ref] = max;

  }

  maxCoverageForRef(ref: string): number {
    return this.refToMaxCoverage[ref] ||
        this.refToMaxCoverage[utils.altContigName(ref)] ||
        0;
  }

  binsForRef(ref: string): {[key: number]: BinSummary} {
    return this.refToCounts[ref] ||
        this.refToCounts[utils.altContigName(ref)] ||
        {};
  }

  // Returns whichever form of the ref ("chr17", "17") has been seen.
  _canonicalRef(ref: string): string {
    if (this.refToCounts[ref]) return ref;
    var alt = utils.altContigName(ref);
    if (this.refToCounts[alt]) return alt;
    return ref;
  }
}

module.exports = CoverageCache;

/**
 * Data management for WiggleTrack.
 *
 * This class tracks counts at each locus.
 *
 * @flow
 */
'use strict';

import type {TwoBitSource} from '../sources/TwoBitDataSource';
import type {BasePair, OpInfo} from './pileuputils';
import type ContigInterval from '../ContigInterval';
import type {BinSummary} from './CoverageCache';
import DepthCache from './DepthCache';

import utils from '../utils';

// This class provides data management for the visualization, grouping paired
// reads and managing the pileup.
class WiggleCache extends DepthCache {
  posCounts: {[key: string]: {[key: number]: {[key: number]: BinSummary}}};
  // maps groupKey to VisualGroup
  // ref --> position --> BinSummary
  // refToCounts: {[key: string]: {[key: number]: BinSummary}};
  refToMaxCoverage: {[key: string]: number};

  constructor() {
    super();
    this.posCounts = {};
    this.refToMaxCoverage = {};
  }

  addValue(ref: string, start: number, end: number, value: number) {
    if (!this.posCounts[ref])
      this.posCounts[ref] = {};
    var refCounts = this.posCounts[ref];
    if (!refCounts[start]) {
      refCounts[start] = {}
    }
    var refStart = refCounts[start];
    if (refStart[end] && refStart[end] != value) {
      throw new Error("Overwriting value " + refStart[end] + " with " + value + " at " + ref + ":[" + start + "," + end + ")");
    }
    refStart[end] = value;
  }

  maxCoverageForRef(ref: string): number {
    return this.refToMaxCoverage[ref] ||
      this.refToMaxCoverage[utils.altContigName(ref)] ||
      0;
  }

  binsForRef(ref: string): {[key: number]: BinSummary} {
    return this.posCounts[ref] ||
      this.posCounts[utils.altContigName(ref)] ||
      {};
  }
}

module.exports = CoverageCache;

/**
 * Data management for CoverageTrack.
 *
 * This class tracks counts and mismatches at each locus.
 *
 * @flow
 */
'use strict';

import type {Strand, Alignment, AlignmentDataSource} from '../Alignment';
import type {TwoBitSource} from '../sources/TwoBitDataSource';
import type {BasePair, OpInfo} from './pileuputils';
import type ContigInterval from '../ContigInterval';
import type Interval from '../Interval';

import {getOpInfo} from './pileuputils';
import utils from '../utils';

export type BinSummary = {
  count: number;
  // These properties will only be present when there are mismatches.
  mismatches?: {[key: string]: number};
  ref?: string;  // what does the reference have here?
};

// This class provides data management for the visualization, grouping paired
// reads and managing the pileup.
class CoverageCache {
  // maps groupKey to VisualGroup
  reads: {[key: string]: Alignment};
  // ref --> position --> BinSummary
  refToCounts: {[key: string]: {[key: number]: BinSummary}};
  refToMaxCoverage: {[key: string]: number};
  referenceSource: TwoBitSource;

  constructor(referenceSource: TwoBitSource) {
    this.reads = {};
    this.refToCounts = {};
    this.refToMaxCoverage = {};
    this.referenceSource = referenceSource;
  }

  // Load a new read into the visualization cache.
  // Calling this multiple times with the same read is a no-op.
  addAlignment(read: Alignment) {
    var key = read.getKey();
    if (key in this.reads) return;  // we've already seen this one.
    this.reads[key] = read;

    var opInfo = getOpInfo(read, this.referenceSource);

    this.addReadToCoverage(read, opInfo);
  }

  // Updates reference mismatch information for previously-loaded reads.
  updateMismatches(range: ContigInterval<string>) {
    var ref = this._canonicalRef(range.contig);
    this.refToCounts[ref] = {};  // TODO: could be more efficient
    this.refToMaxCoverage[ref] = 0;
    for (var k in this.reads) {
      var read = this.reads[k];
      if (read.getInterval().chrOnContig(range.contig)) {
        var opInfo = getOpInfo(read, this.referenceSource);
        this.addReadToCoverage(read, opInfo);
      }
    }
  }

  addReadToCoverage(read: Alignment, opInfo: OpInfo) {
    // Add coverage / variant allele information
    var ref = this._canonicalRef(read.ref);
    if (!(ref in this.refToCounts)) {
      this.refToCounts[ref] = {};
      this.refToMaxCoverage[ref] = 0;
    }

    var counts = this.refToCounts[ref],
        max = this.refToMaxCoverage[ref],
        range = read.getInterval(),
        start = range.start(),
        stop = range.stop();

    var ref_str;
    var alt_str;
    var allele;
    var bin; // pointer to a bin in this.refToCounts (via var counts)

    for (var pos = start; pos <= stop; pos++) {
      let c = counts[pos];
      if (!c) {
        counts[pos] = c = {count: 0};
      }
      c.count += 1;
      if (c.count > max) max = c.count;
    }

    for (var mm of opInfo.mismatches) {
      bin = counts[mm.pos];
      var mismatches;
      if (bin.mismatches) {
        mismatches = bin.mismatches;
      }
      else {
        mismatches = bin.mismatches = {};
        bin.ref = this.referenceSource.getRangeAsString({
          contig: ref,
          start: mm.pos,
          stop: mm.pos
        });
      }
      let c = mismatches[mm.basePair] || 0;
      mismatches[mm.basePair] = 1 + c;
    }

    for (var op of opInfo.ops) {
      if (op.op === 'I') {
        ref_str = this.referenceSource.getRangeAsString({
          contig: ref,
          start: op.pos - 1,
          stop: op.pos - 1
        });
        alt_str = read._seq.substr(op.qpos - 1, op.length + 1);
        allele = ref_str + '>' + alt_str;
        for (let p = op.pos - 1; p <= op.pos; p++) {
          bin = counts[p];
          var insertions;
          if (bin.insertions) {
            insertions = bin.insertions;
          }
          else {
            insertions = bin.insertions = {};
          }
          let c = insertions[allele] || 0;
          insertions[allele] = 1 + c;
        }
      }
      if (op.op === 'D') {
        ref_str = this.referenceSource.getRangeAsString({
          contig: ref,
          start: op.pos - 1,
          stop: op.pos + op.length - 1
        });
        alt_str = ref_str.substr(0, 1);
        allele = ref_str + '>' + alt_str;
        for (let p = op.pos; p < op.pos + op.length; p++) {
          bin = counts[p];
          var deletions;
          if (bin.deletions) {
            deletions = bin.deletions;
          }
          else {
            deletions = bin.deletions = {};
          }
          let c = deletions[allele] || 0;
          deletions[allele] = 1 + c;
        }
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

/**
 * Data management for PileupTrack.
 *
 * This class groups paired reads and piles them up.
 *
 * @flow
 */
'use strict';

import type {Strand, Alignment, AlignmentDataSource} from '../Alignment';
import type {TwoBitSource} from '../sources/TwoBitDataSource';
import type {BasePair} from './pileuputils';

import _ from 'underscore';
import ContigInterval from '../ContigInterval';
import Interval from '../Interval';
import {addToPileup, getOpInfo} from './pileuputils';
import utils from '../utils';

// This bundles everything intrinsic to the alignment that we need to display
// it, i.e. everything not dependend on scale/viewport.
export type VisualAlignment = {
  read: Alignment;
  strand: Strand;
  refLength: number;  // span on the reference (accounting for indels)
  mismatches: Array<BasePair>;
  ops: Object[];
};

// This is typically a read pair, but may be a single read in some situations.
export type VisualGroup = {
  key: string;
  row: number;  // pileup row.
  span: ContigInterval<string>;  // tip-to-tip span for the read group
  insert: ?Interval;  // interval for the connector, if applicable.
  alignments: VisualAlignment[];
};

// Insert sizes within this percentile range will be considered "normal".
const MIN_OUTLIER_PERCENTILE = 0.5;
const MAX_OUTLIER_PERCENTILE = 99.5;
const MAX_INSERT_SIZE = 30000;  // ignore inserts larger than this in calculations
const MIN_READS_FOR_OUTLIERS = 500;  // minimum reads for reliable stats

export type InsertStats = {
  minOutlierSize: number;
  maxOutlierSize: number;
};

// This class provides data management for the visualization, grouping paired
// reads and managing the pileup.
class PileupCache {
  // maps groupKey to VisualGroup
  groups: {[key: string]: VisualGroup};
  refToPileup: {[key: string]: Array<Interval[]>};
  referenceSource: TwoBitSource;
  viewAsPairs: boolean;
  _insertStats: ?InsertStats;

  constructor(referenceSource: TwoBitSource, viewAsPairs: boolean) {
    this.groups = {};
    this.refToPileup = {};
    this.referenceSource = referenceSource;
    this.viewAsPairs = viewAsPairs;
    this._insertStats = null;
  }

  // read name would make a good key, but paired reads from different contigs
  // shouldn't be grouped visually. Hence we use read name + contig.
  groupKey(read: Alignment): string {
    if (this.viewAsPairs) {
      return `${read.name}:${read.ref}`;
    } else {
      return read.getKey();
    }
  }

  // Load a new read into the visualization cache.
  // Calling this multiple times with the same read is a no-op.
  addAlignment(read: Alignment) {
    this._insertStats = null;  // invalidate
    var key = this.groupKey(read),
        range = read.getInterval();

    if (!(key in this.groups)) {
      this.groups[key] = {
        key: key,
        row: -1,  // TBD
        insert: null,  // TBD
        span: range,
        alignments: []
      };
    }
    var group = this.groups[key];

    if (_.find(group.alignments, a => a.read == read)) {
      return;  // we've already got it.
    }

    var opInfo = getOpInfo(read, this.referenceSource);
    var visualAlignment = {
      read,
      strand: read.getStrand(),
      refLength: range.length(),
      ops: opInfo.ops,
      mismatches: opInfo.mismatches
    };
    group.alignments.push(visualAlignment);

    var mateInterval = null;
    if (group.alignments.length == 1) {
      // This is the first read in the group. Infer its span from its mate properties.
      // TODO: if the mate Alignment is also available, it would be better to use that.
      if (this.viewAsPairs) {
        var mateProps = read.getMateProperties();
        var intervals = [range];
        if (mateProps && mateProps.ref && mateProps.ref == read.ref) {
          mateInterval = new ContigInterval(mateProps.ref, mateProps.pos, mateProps.pos + range.length());
          intervals.push(mateInterval);
        }
        group = _.extend(group, spanAndInsert(intervals));
      } else {
        group.span = range;
      }

      if (!(read.ref in this.refToPileup)) {
        this.refToPileup[read.ref] = [];
      }
      var pileup = this.refToPileup[read.ref];
      group.row = addToPileup(group.span.interval, pileup);
    }
    else if (group.alignments.length == 2) {
      // Refine the connector
      mateInterval = group.alignments[0].read.getInterval();
      var {span, insert} = spanAndInsert([range, mateInterval]);
      group.insert = insert;
      if (insert) {
        group.span = span;
      }
    }
    else {
      // this must be a chimeric read.
    }
  }

  // Updates reference mismatch information for previously-loaded reads.
  updateMismatches(range: ContigInterval<string>) {
    for (var k in this.groups) {
      var reads = this.groups[k].alignments;
      for (var vRead of reads) {
        var read = vRead.read;
        if (read.getInterval().chrIntersects(range)) {
          var opInfo = getOpInfo(read, this.referenceSource);
          vRead.mismatches = opInfo.mismatches;
        }
      }
    }
  }

  pileupForRef(ref: string): Array<Interval[]> {
    if (ref in this.refToPileup) {
      return this.refToPileup[ref];
    } else {
      var alt = utils.altContigName(ref);
      if (alt in this.refToPileup) {
        return this.refToPileup[alt];
      } else {
        return [];
      }
    }
  }

  // How many rows tall is the pileup for a given ref? This is related to the
  // maximum read depth. This is 'chr'-agnostic.
  pileupHeightForRef(ref: string): number {
    var pileup = this.pileupForRef(ref);
    return pileup ? pileup.length : 0;
  }

  // Find groups overlapping the range. This is 'chr'-agnostic.
  getGroupsOverlapping(range: ContigInterval<string>): VisualGroup[] {
    // TODO: speed this up using an interval tree
    return _.filter(this.groups, group => group.span.chrIntersects(range));
  }

  // Determine the number of groups at a locus.
  // Like getGroupsOverlapping(range).length > 0, but more efficient.
  anyGroupsOverlapping(range: ContigInterval<string>): boolean {
    for (var k in this.groups) {
      var group = this.groups[k];
      if (group.span.chrIntersects(range)) {
        return true;
      }
    }
    return false;
  }

  // Re-sort the pileup so that reads overlapping the locus are on top.
  sortReadsAt(contig: string, position: number) {
    // Strategy: For each pileup row, determine whether it overlaps the locus.
    // Then sort the array indices to get a permutation.
    // Build a new pileup by permuting the old pileup
    // Update all the `row` properties of the relevant visual groups

    const pileup = this.pileupForRef(contig);

    // Find the groups for which an alignment overlaps the locus.
    var groups = _.filter(this.groups,
          group => _.any(group.alignments,
              a => a.read.getInterval().chrContainsLocus(contig, position)));

    // For each row, find the left-most point (for sorting).
    var rowsOverlapping =
        _.mapObject(_.groupBy(groups, g => g.row),
                    gs => _.min(gs, g=>g.span.start()).span.start());

    // Sort groups by whether they overlap, then by their start.
    // TODO: is there an easier way to construct the forward map directly?
    var permutation = _.sortBy(_.range(0, pileup.length),
                               idx => rowsOverlapping[idx] || Infinity);
    var oldToNew = ([]: number[]);
    permutation.forEach((oldIndex, newIndex) => { oldToNew[oldIndex] = newIndex; });
    var newPileup = _.range(0, pileup.length).map(i => pileup[oldToNew[i]]);

    var normRef = contig in this.refToPileup ? contig : utils.altContigName(contig);
    this.refToPileup[normRef] = newPileup;

    _.each(this.groups, g => {
      if (g.span.chrOnContig(contig)) {
        g.row = oldToNew[g.row];
      }
    });
  }

  getInsertStats(): InsertStats {
    if (this._insertStats) return this._insertStats;
    var inserts = _.map(this.groups,
                        g => g.alignments[0].read.getInferredInsertSize())
                   .filter(x => x < MAX_INSERT_SIZE);
    const insertStats = inserts.length >= MIN_READS_FOR_OUTLIERS ? {
      minOutlierSize: utils.computePercentile(inserts, MIN_OUTLIER_PERCENTILE),
      maxOutlierSize: utils.computePercentile(inserts, MAX_OUTLIER_PERCENTILE)
    } : {
      minOutlierSize: 0,
      maxOutlierSize: Infinity
    };

    this._insertStats = insertStats;
    return insertStats;
  }
}

// Helper method for addRead.
// Given 1-2 intervals, compute their span and insert (interval between them).
// For one interval, these are both trivial.
// TODO: what this calls an "insert" is not what most people mean by that.
function spanAndInsert(intervals: ContigInterval<string>[]) {
  if (intervals.length == 1) {
    return {insert: null, span: intervals[0]};
  } else if (intervals.length !=2) {
    throw `Called spanAndInsert with ${intervals.length} \notin [1, 2]`;
  }

  if (!intervals[0].chrOnContig(intervals[1].contig)) {
    return spanAndInsert([intervals[0]]);
  }
  var iv1 = intervals[0].interval,
      iv2 = intervals[1].interval,
      insert = iv1.start < iv2.start ?
          new Interval(iv1.stop, iv2.start) :
          new Interval(iv2.stop, iv1.start);

  var span = Interval.boundingInterval([iv1, iv2]);
  return {
    insert,
    span: new ContigInterval(intervals[0].contig, span.start, span.stop)
  };
}

module.exports = PileupCache;

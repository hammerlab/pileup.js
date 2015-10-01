/**
 * Data management for PileupTrack.
 *
 * This class groups paired reads and piles them up.
 *
 * @flow
 */
'use strict';

import type {Strand, Alignment, AlignmentDataSource} from './Alignment';
import type {TwoBitSource} from './TwoBitDataSource';
import type {BasePair} from './pileuputils';

var _ = require('underscore'),
    ContigInterval = require('./ContigInterval'),
    Interval = require('./Interval'),
    {addToPileup, getOpInfo} = require('./pileuputils'),
    utils = require('./utils');

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

// read name would make a good key, but paired reads from different contigs
// shouldn't be grouped visually. Hence we use read name + contig.
function groupKey(read: Alignment): string {
  return `${read.name}:${read.ref}`;
}

// This class provides data management for the visualization, grouping paired
// reads and managing the pileup.
class PileupCache {
  // maps groupKey to VisualGroup
  groups: {[key: string]: VisualGroup};
  refToPileup: {[key: string]: Array<Interval[]>};
  referenceSource: TwoBitSource;

  constructor(referenceSource: TwoBitSource) {
    this.groups = {};
    this.refToPileup = {};
    this.referenceSource = referenceSource;
  }

  // Load a new read into the visualization cache.
  // Calling this multiple times with the same read is a no-op.
  addAlignment(read: Alignment) {
    var key = groupKey(read),
        range = read.getInterval(),
        iv = range.interval;

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

    if (group.alignments.length == 1) {
      // This is the first read in the group. Infer its span from its mate properties.
      // TODO: if the mate Alignment is also available, it would be better to use that.
      var intervals = [range];
      var mateProps = read.getMateProperties();
      if (mateProps && mateProps.ref && mateProps.ref == read.ref) {
        var mateInterval = new ContigInterval(mateProps.ref, mateProps.pos, mateProps.pos + range.length());
        intervals.push(mateInterval);
      }
      var {span, insert} = spanAndInsert(intervals);
      group.insert = insert;
      group.span = span;

      if (!(read.ref in this.refToPileup)) {
        this.refToPileup[read.ref] = [];
      }
      var pileup = this.refToPileup[read.ref];
      group.row = addToPileup(span.interval, pileup);
    } else if (group.alignments.length == 2) {
      // Refine the connector
      var mateInterval = group.alignments[0].read.getInterval();
      var {span, insert} = spanAndInsert([range, mateInterval]);
      group.insert = insert;
      if (insert) {
        group.span = span;
      }
    } else {
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

  // How many rows tall is the pileup for a given ref? This is related to the
  // maximum read depth. This is 'chr'-agnostic.
  pileupHeightForRef(ref: string): number {
    if (ref in this.refToPileup) {
      return this.refToPileup[ref].length;
    } else {
      var alt = utils.altContigName(ref);
      if (alt in this.refToPileup) {
        return this.refToPileup[alt].length;
      } else {
        return 0;
      }
    }
  }

  // Find groups overlapping the range. This is 'chr'-agnostic.
  getGroupsOverlapping(range: ContigInterval<string>): VisualGroup[] {
    // TODO: speed this up using an interval tree
    return _.filter(this.groups, group => group.span.chrIntersects(range));
  }
}

// Helper method for addRead.
// Given 1-2 intervals, compute their span and insert (interval between them).
// For one interval, these are both trivial.
function spanAndInsert(intervals: ContigInterval<string>[]) {
  if (intervals.length == 1) {
    return {insert: null, span: intervals[0]};
  } else if (intervals.length !=2) {
    throw `Called spanAndInsert with ${intervals.length} \in [1, 2]`;
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

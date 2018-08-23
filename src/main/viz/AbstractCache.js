/**
 * AbstractCache
 * @flow
 */
'use strict';

import _ from 'underscore';
/*jshint unused:false */
import ContigInterval from '../ContigInterval';
import Interval from '../Interval';

import utils from '../utils';

import type {TwoBitSource} from '../sources/TwoBitDataSource';

import type {VisualAlignment} from './PileupCache';
import GenericFeature from '../data/genericFeature.js';


export type VisualGroup<T: (VisualAlignment | GenericFeature)> = {
  key: string;
  row: number;  // pileup row.
  span: ContigInterval<string>;  // tip-to-tip span for the read group
  insert: ?Interval;  // interval for the connector, if applicable.
  items: T[];
};

class AbstractCache<T: (VisualAlignment | GenericFeature)> {
  // maps groupKey to VisualGroup
  groups: {[key: string]: VisualGroup<T>}; 
  refToPileup: {[key: string]: Array<Interval[]>};
  referenceSource: TwoBitSource;

  constructor(referenceSource: TwoBitSource) {
    this.groups = {};
    this.refToPileup = {};
    this.referenceSource = referenceSource;
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
  getGroupsOverlapping(range: ContigInterval<string>): VisualGroup<T>[] {
    // TODO: speed this up using an interval tree
    return _.filter(this.groups, group => group.span.intersects(range));
  }

  // Determine the number of groups at a locus.
  // Like getGroupsOverlapping(range).length > 0, but more efficient.
  anyGroupsOverlapping(range: ContigInterval<string>): boolean {
    for (var k in this.groups) {
      var group = this.groups[k];
      if (group.span.intersects(range)) {
        return true;
      }
    }
    return false;
  }
}

module.exports = AbstractCache;

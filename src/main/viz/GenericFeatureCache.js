/**
 * Data management for FeatureTrack.
 *
 * This class groups features and piles them up.
 *
 * @flow
 */
'use strict';

import _ from 'underscore';
import ContigInterval from '../ContigInterval';
import GenericFeature from '../data/genericFeature.js';

import Interval from '../Interval';
import {addToPileup} from './pileuputils';
import utils from '../utils';
import type {TwoBitSource} from '../sources/TwoBitDataSource';

export type VisualGroup = {
  key: string;
  span: ContigInterval<string>;  // tip-to-tip span 
  row: number;  // pileup row.
  gFeatures: GenericFeature[]; 
};


// This class provides data management for the visualization
class GenericFeatureCache {
  // maps groupKey to VisualGroup
  groups: {[key: string]: VisualGroup};
  refToPileup: {[key: string]: Array<Interval[]>};
  referenceSource: TwoBitSource;

  constructor(referenceSource: TwoBitSource) {
    this.groups = {};
    this.refToPileup = {};
    this.referenceSource = referenceSource;
  }

  // name would make a good key, but features from different contigs
  // shouldn't be grouped visually. Hence we use feature name + contig.
  groupKey(f: GenericFeature): string {
      return f.id || f.position.toString();
  }

  // Load a new feature into the visualization cache.
  // Calling this multiple times with the same feature is a no-op.
  addFeature(feature: GenericFeature) {
    var key = this.groupKey(feature);

    if (!(key in this.groups)) {
      this.groups[key] = {
        key: key,
        span: feature.position,
        row: -1,  // TBD
        gFeatures: []
      };
    }
    var group = this.groups[key];

    if (_.find(group.gFeatures, f => f.gFeature == feature.gFeature)) {
      return;  // we've already got it.
    }

    group.gFeatures.push(feature);

    if (!(feature.position.contig in this.refToPileup)) {
      this.refToPileup[feature.position.contig] = [];
    }
    var pileup = this.refToPileup[feature.position.contig];
    group.row = addToPileup(group.span.interval, pileup);
   
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
  // maximum track depth. This is 'chr'-agnostic.
  pileupHeightForRef(ref: string): number {
    var pileup = this.pileupForRef(ref);
    return pileup ? pileup.length : 0;
  }

  // Find groups overlapping the range. This is 'chr'-agnostic.
  getGroupsOverlapping(range: ContigInterval<string>): VisualGroup[] {
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

module.exports = {
  GenericFeatureCache
};

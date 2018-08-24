/**
 * Data management for FeatureTrack.
 *
 * This class groups features and piles them up.
 *
 * @flow
 */
'use strict';

import _ from 'underscore';

/*jshint unused:false */
import GenericFeature from '../data/genericFeature.js';
import Interval from '../Interval';

import {addToPileup} from './pileuputils';
import type {TwoBitSource} from '../sources/TwoBitDataSource';
import AbstractCache from './AbstractCache';
import type {VisualGroup} from './AbstractCache';

// This class provides data management for the visualization
class GenericFeatureCache extends AbstractCache<GenericFeature> {
  // maps groupKey to VisualGroup
  groups: {[key: string]: VisualGroup<GenericFeature>};
  refToPileup: {[key: string]: Array<Interval[]>};
  referenceSource: TwoBitSource;

  constructor(referenceSource: TwoBitSource) {
    super(referenceSource);
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
        insert: null,
        items: []
      };
    }
    var group = this.groups[key];

    if (_.find(group.items, f => f.gFeature == feature.gFeature)) {
      return;  // we've already got it.
    }

    group.items.push(feature);

    if (!(feature.position.contig in this.refToPileup)) {
      this.refToPileup[feature.position.contig] = [];
    }
    var pileup = this.refToPileup[feature.position.contig];
    group.row = addToPileup(group.span.interval, pileup);
   
  }
}

module.exports = {
  GenericFeatureCache
};

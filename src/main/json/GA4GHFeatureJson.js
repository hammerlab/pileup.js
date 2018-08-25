/**
 * A data source which implements generic JSON protocol.
 * Currently only used to load alignments.
 * @flow
 */
'use strict';

import type {FeatureDataSource} from '../sources/BigBedDataSource';
import Feature from '../data/feature';

import _ from 'underscore';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';
import type {GenomeRange} from '../types';

function create(json: string): FeatureDataSource {

  // parse json
  var parsedJson = JSON.parse(json);
  var features: Feature[] = [];

  // fill features with json
  if (!_.isEmpty(parsedJson)) {
      features = _.values(parsedJson.features).map(feature => Feature.fromGA4GH(feature));
  }

  function rangeChanged(newRange: GenomeRange) {
    // Data is already parsed, so immediately return
    var range = new ContigInterval(newRange.contig, newRange.start, newRange.stop);
    o.trigger('newdata', range);
    o.trigger('networkdone');
    return;
  }

  function getFeaturesInRange(range: ContigInterval<string>): Feature[] {
    if (!range) return [];
    var r = _.filter(features, feature => feature.intersects(range));
    return r;
  }

  var o = {
    rangeChanged,
    getFeaturesInRange,

    on: () => {},
    once: () => {},
    off: () => {},
    trigger: (string, any) => {}
  };
  _.extend(o, Events);
  return o;
}

module.exports = {
  create
};

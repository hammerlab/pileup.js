/**
 * A data source which implements generic JSON protocol.
 * Currently only used to load alignments.
 * @flow
 */
'use strict';

import type {VcfDataSource} from '../sources/VcfDataSource';
import {Variant} from '../data/variant';

import _ from 'underscore';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';

function create(json: string): VcfDataSource {

  // parse json
  var parsedJson = JSON.parse(json);
  var variants: Variant[] = [];

  // fill variants with json
  if (!_.isEmpty(parsedJson)) {
      variants = _.values(parsedJson.variants).map(feature => Variant.fromGA4GH(feature));
  }

  function rangeChanged(newRange: GenomeRange) {
    // Data is already parsed, so immediately return
    var range = new ContigInterval(newRange.contig, newRange.start, newRange.stop);
    o.trigger('newdata', range);
    o.trigger('networkdone');
    return;
  }

  function getFeaturesInRange(range: ContigInterval<string>): Variant[] {
    if (!range) return [];
    var r = _.filter(variants, variant => variant.intersects(range));
    return r;
  }

  var o = {
    rangeChanged,
    getFeaturesInRange,

    on: () => {},
    once: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);
  return o;
}

module.exports = {
  create
};

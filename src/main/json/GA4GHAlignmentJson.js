/**
 * A data source which implements generic JSON protocol.
 * Currently only used to load alignments.
 * @flow
 */
'use strict';

import type {Alignment, AlignmentDataSource} from '../Alignment';
import type {GenomeRange} from '../types';

import _ from 'underscore';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';
import GA4GHAlignment from '../GA4GHAlignment';

function create(json: string): AlignmentDataSource {

  // parse json
  var parsedJson = JSON.parse(json);
  var reads: Alignment[] = [];

  // fill reads with json
  if (!_.isEmpty(parsedJson)) {
      reads = _.values(parsedJson.alignments).map(alignment => new GA4GHAlignment(alignment));
  }

  function rangeChanged(newRange: GenomeRange) {
    // Data is already parsed, so immediately return
    var range = new ContigInterval(newRange.contig, newRange.start, newRange.stop);
    o.trigger('newdata', range);
    o.trigger('networkdone');
    return;
  }

  function getAlignmentsInRange(range: ContigInterval<string>): Alignment[] {
    if (!range) return [];
    var r = _.filter(reads, read => read.intersects(range));
    return r;
  }

  var o = {
    rangeChanged,
    getAlignmentsInRange,

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

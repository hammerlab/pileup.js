/**
 * A data source which implements generic JSON protocol.
 * Currently only used to load alignments.
 * @flow
 */
'use strict';

import type {DataSource} from '../sources/DataSource';
import Chromosome from '../data/chromosome';

import _ from 'underscore';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';
import type {GenomeRange} from '../types';

function create(json: string): DataSource<Chromosome> {

  // parse json
  var parsedJson = JSON.parse(json);
  var chromosomes: Chromosome[] = [];

  // fill chromosomes with json
  if (!_.isEmpty(parsedJson)) {
      chromosomes = _.values(parsedJson).map(chr => new Chromosome(chr));
  }

  function rangeChanged(newRange: GenomeRange) {
    // Data is already parsed, so immediately return
    var range = new ContigInterval(newRange.contig, newRange.start, newRange.stop);
    o.trigger('newdata', range);
    o.trigger('networkdone');
    return;
  }

  function getFeaturesInRange(range: ContigInterval<string>): Chromosome[] {
    // this is abusing the function name TODO
    return chromosomes;
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

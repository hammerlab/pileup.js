/**
 * Caching & prefetching for VCF sources.
 *
 * @flow
 */
'use strict';

var Events = require('backbone').Events,
    _ = require('underscore'),
    Q = require('q');

var ContigInterval = require('./ContigInterval'),
    RemoteFile = require('./RemoteFile'),
    VcfFile = require('./vcf');

import type {Variant} from './vcf';

export type VcfDataSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getFeaturesInRange: (range: ContigInterval<string>) => Variant[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
};


var BASE_PAIRS_PER_FETCH = 100;
function expandRange(range: ContigInterval<string>) {
  var roundDown = x => x - x % BASE_PAIRS_PER_FETCH;
  var newStart = Math.max(1, roundDown(range.start())),
      newStop = roundDown(range.stop() + BASE_PAIRS_PER_FETCH - 1);

  return new ContigInterval(range.contig, newStart, newStop);
}

function variantKey(v: Variant): string {
  return `${v.contig}:${v.position}`;
}


function createFromVcfFile(remoteSource: VcfFile): VcfDataSource {
  var variants: {[key: string]: Variant} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addVariant(v: Variant) {
    var key = variantKey(v);
    if (!variants[key]) {
      variants[key] = v;
    }
  }

  function fetch(range: GenomeRange) {
    var interval = new ContigInterval(range.contig, range.start, range.stop);

    // Check if this interval is already in the cache.
    if (interval.isCoveredBy(coveredRanges)) {
      return Q.when();
    }

    interval = expandRange(interval);

    // "Cover" the range immediately to prevent duplicate fetches.
    coveredRanges.push(interval);
    coveredRanges = ContigInterval.coalesce(coveredRanges);
    return remoteSource.getFeaturesInRange(interval).then(variants => {
      variants.forEach(variant => addVariant(variant));
      o.trigger('newdata', interval);
    });
  }

  function getFeaturesInRange(range: ContigInterval<string>): Variant[] {
    if (!range) return [];  // XXX why would this happen?
    return _.filter(variants, v => range.chrContainsLocus(v.contig, v.position));
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange).done();
    },
    getFeaturesInRange,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
}

function create(data: {url:string}): VcfDataSource {
  var url = data.url;
  if (!url) {
    throw new Error(`Missing URL from track: ${JSON.stringify(data)}`);
  }

  return createFromVcfFile(new VcfFile(new RemoteFile(url)));
}

module.exports = {
  create,
  createFromVcfFile
};

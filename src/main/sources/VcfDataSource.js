/**
 * Caching & prefetching for VCF sources.
 *
 * @flow
 */
'use strict';


import Events from 'backbone';
import _ from 'underscore';
import Q from 'q';
import type {GenomeRange} from '../types';
import ContigInterval from '../ContigInterval';
import RemoteFile from '../RemoteFile';
import LocalStringFile from '../LocalStringFile';
// requirement for jshint to pass
/* exported Variant */
import {Variant, VariantContext} from '../data/variant';
import {VcfFile, VcfWithTabixFile} from '../data/vcf';


export type VcfDataSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getVariantsInRange: (range: ContigInterval<string>) => Variant[];
  getGenotypesInRange: (range: ContigInterval<string>) => VariantContext[];
  getCallNames: () => Q.Promise<string[]>;
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
};


var BASE_PAIRS_PER_FETCH = 100;
var ZERO_BASED = false;

function variantContextKey(v: VariantContext): string {
  return `${v.variant.contig}:${v.variant.position}`;
}


function createFromVcfFile(remoteSource: VcfFile): VcfDataSource {
  var variants: {[key: string]: VariantContext} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addVariantContext(v: VariantContext) {
    var key = variantContextKey(v);
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

    interval = interval.round(BASE_PAIRS_PER_FETCH, ZERO_BASED);

    // "Cover" the range immediately to prevent duplicate fetches.
    coveredRanges.push(interval);
    coveredRanges = ContigInterval.coalesce(coveredRanges);
    return remoteSource.getFeaturesInRange(interval).then(variants => {
      variants.forEach(variant => addVariantContext(variant));
      o.trigger('newdata', interval);
    });
  }

  function getVariantsInRange(range: ContigInterval<string>): Variant[] {
    if (!range) return [];  // XXX why would this happen?
    var filtered = _.filter(variants, v => range.containsLocus(v.variant.contig, v.variant.position));
    return _.map(filtered, f => f.variant);
  }

  function getGenotypesInRange(range: ContigInterval<string>): VariantContext[] {
    return _.filter(variants, v => range.containsLocus(v.variant.contig, v.variant.position));
  }

  function getCallNames(): Q.Promise<string[]> {
    return remoteSource.getCallNames().then(samples => {
      return samples;
    });
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange).done();
    },
    getVariantsInRange,
    getGenotypesInRange,
    getCallNames,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: (status: string, param: any) => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
}

function create(data: {url?: string, content?: string}): VcfDataSource {
  var {url, content} = data;
  if (url) {
    return createFromVcfFile(new VcfFile(new RemoteFile(url)));
  } else if (content) {
    return createFromVcfFile(new VcfFile(new LocalStringFile(content)));
  }
  // If no URL or content is passed, fail
  throw new Error(`Missing URL or content from track: ${JSON.stringify(data)}`);
}

function createWithTabix(data: {vcfUrl: string, tabixUrl: string}): VcfDataSource {
  console.log("!!!!");
  var {vcfUrl, tabixUrl} = data;
  console.log(data);
  console.log("!!!!");
  return createFromVcfFile(new VcfWithTabixFile(vcfUrl, tabixUrl));
}

module.exports = {
  create,
  createWithTabix,
  createFromVcfFile
};

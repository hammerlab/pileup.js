/**
 * A data source which implements the GA4GH Variant protocol.
 * @flow
 */
'use strict';

import _ from 'underscore';
import Q from 'q';
import {Events} from 'backbone';
import type {GenomeRange} from '../types';
import ContigInterval from '../ContigInterval';

import type {VcfDataSource} from './VcfDataSource';
import {Variant, VariantContext} from '../data/variant';

var BASE_PAIRS_PER_FETCH = 100;
var VARIANTS_PER_REQUEST = 400;
var ZERO_BASED = false;

type GA4GHVariantSpec = {
  endpoint: string;
  variantSetId: string;
  callSetIds: string[];
  callSetNames: ?string[]; // optional parameter for displaying call set names.
                           // Without this parameter, users must make extra http
                           // request for call set names for Genotype Track display
};

function create(spec: GA4GHVariantSpec): VcfDataSource {
  var url = spec.endpoint + '/variants/search';

  var variants: {[key:string]: VariantContext} = {};


  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addVariantsFromResponse(response: Object) {
    if (response.variants === undefined) {
      return;
    }

    response.variants.forEach(ga4ghVariant => {
      var key = ga4ghVariant.id;
      if (key in variants) return;

      var variant = new VariantContext(Variant.fromGA4GH(ga4ghVariant), ga4ghVariant.calls);
      variants[key] = variant;
    });
  }

  function rangeChanged(newRange: GenomeRange) {
    var interval = new ContigInterval(newRange.contig, newRange.start, newRange.stop);

    if (interval.isCoveredBy(coveredRanges)) return;

    interval = interval.round(BASE_PAIRS_PER_FETCH, ZERO_BASED);

    // select only intervals not yet loaded into coveredRangesß
    var intervals = interval.complementIntervals(coveredRanges);

    // We "cover" the interval immediately (before the reads have arrived) to
    // prevent duplicate network requests.
    coveredRanges.push(interval);
    coveredRanges = ContigInterval.coalesce(coveredRanges);

    intervals.forEach(i => {
      fetchVariantsForInterval(i, null, 1 /* first request */);
    });
  }

  function notifyFailure(message: string) {
    o.trigger('networkfailure', message);
    o.trigger('networkdone');
    console.warn(message);
  }

  function fetchVariantsForInterval(range: ContigInterval<string>,
                                      pageToken: ?string,
                                      numRequests: number) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'json';
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.addEventListener('load', function(e: any) {
      var response = this.response;
      if (this.status >= 400) {
        notifyFailure(this.status + ' ' + this.statusText + ' ' + JSON.stringify(response));
      } else {
        if (response.errorCode) {
          notifyFailure('Error from GA4GH Variant endpoint: ' + JSON.stringify(response));
        } else {
          addVariantsFromResponse(response);
          o.trigger('newdata', range);  // display data as it comes in.
          if (response.nextPageToken) {
            fetchVariantsForInterval(range, response.nextPageToken, numRequests + 1);
          } else {
            o.trigger('networkdone');
          }
        }
      }
    });
    xhr.addEventListener('error', function(e: any) {
      notifyFailure('Request failed with status: ' + this.status);
    });

    o.trigger('networkprogress', {numRequests});
    xhr.send(JSON.stringify({
      variantSetId: spec.variantSetId,
      pageToken: pageToken,
      pageSize: VARIANTS_PER_REQUEST,
      referenceName: range.contig,
      callSetIds: spec.callSetIds,
      start: range.start(),
      end: range.stop()
    }));
  }

  function getVariantsInRange(range: ContigInterval<string>): Variant[] {
    if (!range) return [];

    var filtered = _.filter(variants, variant => variant.intersects(range));
    return _.map(filtered, f => f.variant);
  }

  function getGenotypesInRange(range: ContigInterval<string>): VariantContext[] {
      if (!range) return [];

      return _.filter(variants, variant => variant.intersects(range));
  }

  function getCallNames(): Q.Promise<string[]> {
    if (spec.callSetNames) {
      return Q.Promise.resolve(spec.callSetNames);
    } else {
      return Q.Promise.resolve(spec.callSetIds);
    }

  }

  var o = {
    rangeChanged,
    getVariantsInRange,
    getGenotypesInRange,
    getCallNames,

    // These are here to make Flow happy.
    on: () => {},
    once: () => {},
    off: () => {},
    trigger: (status: string, param: any) => {}
  };
  _.extend(o, Events);  // Make this an event emitter
  return o;
}

module.exports = {
  create
};

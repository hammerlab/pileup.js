/**
 * A data source which implements the GA4GH Variant protocol.
 * @flow
 */
'use strict';

import _ from 'underscore';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';

import type {VcfDataSource} from './VcfDataSource';
import type {Variant} from '../data/vcf';
import {expandRange} from '../utils';

var BASE_PAIRS_PER_FETCH = 100;
var VARIANTS_PER_REQUEST = 400;

type GA4GHVariantSpec = {
  endpoint: string;
  variantSetId: string;
  callSetIds: string[];
};

function create(spec: GA4GHVariantSpec): VcfDataSource {
  if (spec.endpoint.slice(-6) != 'v0.6.0') {
    throw new Error('Only v0.6.0 of the GA4GH API is supported by pileup.js');
  }

  var url = spec.endpoint + '/variants/search';

  var variants: {[key:string]: Variant} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addVariantsFromResponse(response: Object) {
    response.variants.forEach(ga4ghVariant => {
      var key = ga4ghVariant.id;
      if (key in variants) return;

      var variant =
         {
          contig: ga4ghVariant.referenceName,
          position: ga4ghVariant.start,
          id: ga4ghVariant.id,
          ref: ga4ghVariant.referenceBases,
          alt: ga4ghVariant.alternateBases,
          majorFrequency: 0,
          minorFrequency: 0, // TODO extract these
          vcfLine: "" // TODO
        };
      variants[key] = variant;
    });
  }

  function rangeChanged(newRange: GenomeRange) {
    var interval = new ContigInterval(newRange.contig, newRange.start, newRange.stop);
    if (interval.isCoveredBy(coveredRanges)) return;

    interval = expandRange(interval, BASE_PAIRS_PER_FETCH);

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

    xhr.addEventListener('load', function(e) {
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
    xhr.addEventListener('error', function(e) {
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

  function getFeaturesInRange(range: ContigInterval<string>): Variant[] {
    if (!range) return [];
    return _.filter(variants, variant => intersects(variant, range));
  }

  var o = {
    rangeChanged,
    getFeaturesInRange,

    // These are here to make Flow happy.
    on: () => {},
    once: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter
  return o;
}

function intersects(variant: Variant, range: ContigInterval<string>): boolean {
  var thisRange = new ContigInterval(variant.contig, variant.position, variant.position + 1);
  return range.intersects(thisRange);
}

module.exports = {
  create
};

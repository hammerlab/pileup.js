/**
 * A data source which implements the GA4GH Feature protocol.
 * @flow
 */
'use strict';

import _ from 'underscore';
import {Events} from 'backbone';
import type {GenomeRange} from '../types';
import ContigInterval from '../ContigInterval';

import type {FeatureDataSource} from './BigBedDataSource';
import Feature from '../data/feature';

var BASE_PAIRS_PER_FETCH = 100;
var FEATURES_PER_REQUEST = 400;
var ZERO_BASED = false;

type GA4GHFeatureSpec = {
  endpoint: string;
  featureSetId: string;
};

function create(spec: GA4GHFeatureSpec): FeatureDataSource {
  var url = spec.endpoint + '/features/search';

  var features: {[key:string]: Feature} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addFeaturesFromResponse(response: Object) {
    if (response.features === undefined) {
      return;
    }

    response.features.forEach(ga4ghFeature => {
      var contigInterval = new ContigInterval(ga4ghFeature.referenceName, ga4ghFeature.start, ga4ghFeature.end);

      var key = ga4ghFeature.id + contigInterval.toString();
      if (key in features) return;
      var feature = Feature.fromGA4GH(ga4ghFeature);
      features[key] = feature;
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
      fetchFeaturesForInterval(i, null, 1 /* first request */);
    });
  }

  function notifyFailure(message: string) {
    o.trigger('networkfailure', message);
    o.trigger('networkdone');
    console.warn(message);
  }

  function fetchFeaturesForInterval(range: ContigInterval<string>,
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
          notifyFailure('Error from GA4GH Feature endpoint: ' + JSON.stringify(response));
        } else {
          addFeaturesFromResponse(response);
          o.trigger('newdata', range);  // display data as it comes in.
          if (response.nextPageToken) {
            fetchFeaturesForInterval(range, response.nextPageToken, numRequests + 1);
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
      featureSetId: spec.featureSetId,
      pageToken: pageToken,
      pageSize: FEATURES_PER_REQUEST,
      referenceName: range.contig,
      start: range.start(),
      end: range.stop()
    }));
  }

  function getFeaturesInRange(range: ContigInterval<string>): Feature[] {
    if (!range) return [];
    return _.filter(features, feature => feature.intersects(range));
  }

  var o = {
    rangeChanged,
    getFeaturesInRange,

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

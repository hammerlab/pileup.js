/**
 * A data source which implements the GA4GH Feature protocol.
 * @flow
 */
'use strict';

import _ from 'underscore';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';

import type {BigBedSource, Gene} from './BigBedDataSource';
import {expandRange} from '../utils';

var BASE_PAIRS_PER_FETCH = 100;
var FEATURES_PER_REQUEST = 400;

type GA4GHFeatureSpec = {
  endpoint: string;
  featureSetId: string;
};

function create(spec: GA4GHFeatureSpec): BigBedSource {
  if (spec.endpoint.slice(-6) != 'v0.6.0') {
    throw new Error('Only v0.6.0 of the GA4GH API is supported by pileup.js');
  }

  var url = spec.endpoint + '/features/search';

  // TODO maybe rename gene
  var features: {[key:string]: Gene} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addFeaturesFromResponse(response: Object) {
    response.featuress.forEach(ga4ghFeature => {
      var key = ga4ghFeature.id;
      if (key in features) return;

      var contigInterval = new ContigInterval(ga4ghFeature.referenceName, ga4ghFeature.start, ga4ghFeature.end);
      var feature =
         {
           position: contigInterval,
           id: ga4ghFeature.id,
           strand: ga4ghFeature.strand,
           codingRegion: contigInterval.interval,
           exons: Array(),
           geneId: ga4ghFeature.gene_id,
           name: ga4ghFeature.name
        };
      features[key] = feature;
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

    xhr.addEventListener('load', function(e) {
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
    xhr.addEventListener('error', function(e) {
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

  function getGenesInRange(range: ContigInterval<string>): Gene[] {
    if (!range) return [];
    return _.filter(features, feature => intersects(feature, range));
  }

  var o = {
    rangeChanged,
    getGenesInRange,

    // These are here to make Flow happy.
    on: () => {},
    once: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter
  return o;
}

function intersects(feature: Gene, range: ContigInterval<string>): boolean {
  return range.intersects(feature.position);
}

module.exports = {
  create
};

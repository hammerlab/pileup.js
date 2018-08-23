/**
 * A data source which implements the GA4GH protocol.
 * Currently only used to load alignments.
 * @flow
 */
'use strict';

import type {GenomeRange} from '../types';
import type {Alignment, AlignmentDataSource} from '../Alignment';

import _ from 'underscore';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';
import GA4GHAlignment from '../GA4GHAlignment';

var ALIGNMENTS_PER_REQUEST = 200;  // TODO: explain this choice.
var ZERO_BASED = false;


// Genome ranges are rounded to multiples of this for fetching.
// This reduces network activity while fetching.
// TODO: tune this value -- setting it close to the read length will result in
// lots of reads being fetched twice, but setting it too large will result in
// bulkier requests.
var BASE_PAIRS_PER_FETCH = 100;

type GA4GHSpec = {
  endpoint: string;
  readGroupId: string;
  // HACK for demo. If set, will always use this reference id.
  // This is for fetching referenceIds specified in GA4GH reference
  // server
  forcedReferenceId: ?string;
};

function create(spec: GA4GHSpec): AlignmentDataSource {
  var url = spec.endpoint + '/reads/search';

  var reads: {[key:string]: Alignment} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addReadsFromResponse(response: Object) {
    if (response.alignments === undefined) {
      return;
    }
    response.alignments.forEach(alignment => {
      // optimization: don't bother constructing a GA4GHAlignment unless it's new.
      var key = GA4GHAlignment.keyFromGA4GHResponse(alignment);
      if (key in reads) return;
      try {
        var ga4ghAlignment = new GA4GHAlignment(alignment);
        reads[key] = ga4ghAlignment;
      } catch (e) {
        // sometimes, data from the server does not have an alignment.
        // this will catch an exception in the GA4GHAlignment constructor
      }
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
      fetchAlignmentsForInterval(i, null, 1 /* first request */);
    });
  }

  function notifyFailure(message: string) {
    o.trigger('networkfailure', message);
    o.trigger('networkdone');
    console.warn(message);
  }

  function fetchAlignmentsForInterval(range: ContigInterval<string>,
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
          notifyFailure('Error from GA4GH endpoint: ' + JSON.stringify(response));
        } else {
          addReadsFromResponse(response);
          o.trigger('newdata', range);  // display data as it comes in.
          if (response.nextPageToken) {
            fetchAlignmentsForInterval(range, response.nextPageToken, numRequests + 1);
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
    // hack for DEMO. force GA4GH reference ID
    var contig = range.contig;
    if (spec.forcedReferenceId !== undefined)
    {
      contig = spec.forcedReferenceId;
    }
    xhr.send(JSON.stringify({
      pageToken: pageToken,
      pageSize: ALIGNMENTS_PER_REQUEST,
      readGroupIds: [spec.readGroupId],
      referenceId: contig,
      start: range.start(),
      end: range.stop()
    }));
  }

  function getAlignmentsInRange(range: ContigInterval<string>): Alignment[] {
    if (!range) return [];

    range = new ContigInterval(range.contig, range.start(), range.stop());

    return _.filter(reads, read => read.intersects(range));
  }

  var o = {
    rangeChanged,
    getAlignmentsInRange,

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

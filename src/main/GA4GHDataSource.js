/**
 * A data source which implements the GA4GH protocol.
 * Currently only used to load alignments.
 * @flow
 */
'use strict';

import type {Alignment, AlignmentDataSource} from './Alignment';

var Events = require('backbone').Events,
    _ = require('underscore');

var ContigInterval = require('./ContigInterval'),
    GA4GHAlignment = require('./GA4GHAlignment');

var ALIGNMENTS_PER_REQUEST = 200;  // TODO: explain this choice.


// Genome ranges are rounded to multiples of this for fetching.
// This reduces network activity while fetching.
// TODO: tune this value -- setting it close to the read length will result in
// lots of reads being fetched twice, but setting it too large will result in
// bulkier requests.
var BASE_PAIRS_PER_FETCH = 100;

function expandRange(range: ContigInterval<string>) {
  var roundDown = x => x - x % BASE_PAIRS_PER_FETCH;
  var newStart = Math.max(1, roundDown(range.start())),
      newStop = roundDown(range.stop() + BASE_PAIRS_PER_FETCH - 1);

  return new ContigInterval(range.contig, newStart, newStop);
}

type GA4GHSpec = {
  endpoint: string;
  readGroupId: string;
  // HACK if set, strips "chr" from reference names.
  // See https://github.com/ga4gh/schemas/issues/362
  killChr: boolean;
};

function create(spec: GA4GHSpec): AlignmentDataSource {
  if (spec.endpoint.slice(-6) != 'v0.5.1') {
    throw new Error('Only v0.5.1 of the GA4GH API is supported by pileup.js');
  }

  var url = spec.endpoint + '/reads/search';

  var reads: {[key:string]: Alignment} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addReadsFromResponse(response: Object) {
    response.alignments.forEach(alignment => {
      // optimization: don't bother constructing a GA4GHAlignment unless it's new.
      var key = GA4GHAlignment.keyFromGA4GHResponse(alignment);
      if (key in reads) return;

      var ga4ghAlignment = new GA4GHAlignment(alignment);
      reads[key] = ga4ghAlignment;
    });
  }

  function rangeChanged(newRange: GenomeRange) {
    // HACK FOR DEMO
    var contig = spec.killChr ? newRange.contig.replace(/^chr/, '') : newRange.contig;
    var interval = new ContigInterval(contig, newRange.start, newRange.stop);
    if (interval.isCoveredBy(coveredRanges)) return;

    interval = expandRange(interval);

    // We "cover" the interval immediately (before the reads have arrived) to
    // prevent duplicate network requests.
    coveredRanges.push(interval);
    coveredRanges = ContigInterval.coalesce(coveredRanges);
    fetchAlignmentsForInterval(interval, null, 1 /* first request */);
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

    xhr.addEventListener('load', function(e) {
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
    xhr.addEventListener('error', function(e) {
      notifyFailure('Request failed with status: ' + this.status);
    });

    o.trigger('networkprogress', {numRequests});
    xhr.send(JSON.stringify({
      pageToken: pageToken,
      pageSize: ALIGNMENTS_PER_REQUEST,
      readGroupIds: [spec.readGroupId],
      referenceName: range.contig,
      start: range.start(),
      end: range.stop()
    }));
  }

  function getAlignmentsInRange(range: ContigInterval<string>): Alignment[] {
    if (!range) return [];

    // HACK FOR DEMO
    if (spec.killChr) {
      range = new ContigInterval(range.contig.replace(/^chr/, ''), range.start(), range.stop());
    }
    return _.filter(reads, read => read.intersects(range));
  }

  var o = {
    rangeChanged,
    getAlignmentsInRange,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter
  return o;
}

module.exports = {
  create
};

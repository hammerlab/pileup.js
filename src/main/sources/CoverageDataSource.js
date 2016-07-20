/**
 * Remote Endpoint for coverage.
 *
 * CoverageDataSource is purely for data parsing and fetching.
 * Coverage for CoverageDataSource can be calculated from any source,
 * including, but not limited to, Alignment Records,
 * variants or features.
 *
 * @flow
 */
'use strict';

import Q from 'q';
import _ from 'underscore';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';
import RemoteRequest from '../RemoteRequest';

export type CoverageDataSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getCoverageInRange: (range: ContigInterval<string>) => PositionCount[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
};

var BASE_PAIRS_PER_FETCH = 1000;

export type PositionCount = {
  contig: string;
  position: number;
  count: number;
}

function positionCountKey(p: PositionCount): string {
  return `${p.contig}:${p.position}`;
}

function createFromCoverageUrl(remoteSource: RemoteRequest): CoverageDataSource {
  var positions: {[key: string]: PositionCount} = {};

  // Ranges for which we have complete coverage
  var coveredRanges: ContigInterval<string>[] = [];

  function addPosition(p: PositionCount) {
    var key = positionCountKey(p);
    if (!positions[key]) {
      positions[key] = p;
    }
  }

  function fetch(range: GenomeRange) {
    var interval = new ContigInterval(range.contig, range.start, range.stop);

    // Check if this interval is already in the cache.
    if (interval.isCoveredBy(coveredRanges)) {
      return Q.when();
    }

    // "Cover" the range immediately to prevent duplicate fetches.
    coveredRanges.push(interval);
    coveredRanges = ContigInterval.coalesce(coveredRanges);
    return remoteSource.getFeaturesInRange(interval).then(positions => {
      positions.forEach(position => addPosition(position));
      o.trigger('newdata', interval);
    });
  }

  function getCoverageInRange(range: ContigInterval<string>): PositionCount[] {
    if (!range) return [];
    return _.filter(positions, p => range.chrContainsLocus(p.contig, p.position));
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange).done();
    },
    getCoverageInRange,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);

  return o;
}

function create(data: {url?:string}): CoverageDataSource {
  if (!data.url) {
    throw new Error(`Missing URL from track: ${JSON.stringify(data)}`);
  }

  var endpoint = new RemoteRequest(data.url, BASE_PAIRS_PER_FETCH);
  return createFromCoverageUrl(endpoint);
}


module.exports = {
  create,
  createFromCoverageUrl
};

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
import {ResolutionCache} from '../ResolutionCache';
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

function keyFunction(p: PositionCount): string {
  return `${p.contig}:${p.position}`;
}

function filterFunction(range: ContigInterval<string>, p: PositionCount): boolean {
  return range.chrContainsLocus(p.contig, p.position);
}

function createFromCoverageUrl(remoteSource: RemoteRequest): CoverageDataSource {
  var cache: ResolutionCache<PositionCount> =
    new ResolutionCache(filterFunction, keyFunction);

  function fetch(range: GenomeRange) {
    var interval = new ContigInterval(range.contig, range.start, range.stop);

    // Check if this interval is already in the cache.
    if (cache.coversRange(interval)) {
      return Q.when();

    }

    // modify endpoint to calculate coverage using binning
    var basePairsPerBin = ResolutionCache.getResolution(interval.interval);
    var endpointModifier = `binning=${basePairsPerBin}`;

    // Cover the range immediately to prevent duplicate fetches.
    cache.coverRange(interval);
    return remoteSource.getFeaturesInRange(interval, endpointModifier).then(positions => {
      positions.forEach(p => cache.put(p));
      o.trigger('newdata', interval);
    });
  }

  function getCoverageInRange(range: ContigInterval<string>): PositionCount[] {
    if (!range) return [];
    return cache.get(range);
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

/** @flow */
'use strict';

import {expect} from 'chai';

import ContigInterval from '../main/ContigInterval';
import {ResolutionCache} from '../main/ResolutionCache';

describe('ResolutionCache', function() {

  // Type used for testing cache
  type Position = {
    contig: string;
    position: number;
  }

  var smRange = new ContigInterval("chrM", 0, 100);
  var smRange2 = new ContigInterval("chrM", 100, 200);
  var smRange3 = new ContigInterval("chrM", 300, 400);

  var bigRange = new ContigInterval("chrM", 0, 1000000);
  var data: Position[] = [{contig:'chrM',position:2},
              {contig:'chrM',position:3},
              {contig:'chrM',position:6},
              {contig:'chrM',position:107}];

  function filterFunction(range: ContigInterval<string>, p: Position): boolean {
    return range.chrContainsLocus(p.contig, p.position);
  }

  function keyFunction(p: Position): string {
    return `${p.contig}:${p.position}`;
  }

  function createCache(): ResolutionCache<Position> {
    var cache = new ResolutionCache(filterFunction, keyFunction);
    return cache;
  }


  it('should create cache', function() {
    var cache: ResolutionCache<Position> = createCache();
    expect(cache == {});
  });

  it('should put and get data in range', function() {
    var cache: ResolutionCache<Position> = createCache();
    cache.coverRange(smRange);
    data.forEach(p => cache.put(p));
    var d = cache.get(smRange);
    expect(d.length == 3);
  });

  it('should cover ranges after put', function() {
    var cache: ResolutionCache<Position> = createCache();
    cache.coverRange(smRange);
    data.forEach(p => cache.put(p));
    var covered = cache.coversRange(smRange);
    expect(covered === true);
  });

  it('should clear the cache', function() {
    var cache: ResolutionCache<Position> = createCache();
    cache.coverRange(smRange);
    data.forEach(p => cache.put(p));
    cache.clear();
    expect(cache.cache == {});
    expect(cache.coveredRanges == []);
  });

  it('should return false when finer resolution was not yet loaded', function() {
    var cache: ResolutionCache<Position> = createCache();
    cache.coverRange(bigRange);
    var covered = cache.coversRange(smRange);
    expect(covered === false);
  });

  it('should coalesce the covered ranges', function() {
    var cache: ResolutionCache<Position> = createCache();
    cache.coverRange(smRange);
    cache.coverRange(smRange3);
    expect(cache.coveredRanges.length == 2);

    cache.coverRange(smRange2);
    expect(cache.coveredRanges.length == 2);
  });

});

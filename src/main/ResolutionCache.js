/**
 * Cache for any Data Sources that rely on resolution. For example,
 * this is used by coverage to keep track of the difference resolutions
 * that have been fetched already.
 *
 * @flow
 */
'use strict';

import _ from 'underscore';
import Interval from './Interval';
import ContigInterval from './ContigInterval';

class ResolutionCache<T: Object> {
  coveredRanges: ResolutionCacheKey[];
  cache: {[key: string]: T};
  filterFunction: Function; // should take form (range: ContigInterval<string>, T) => boolean;
  keyFunction: Function;    // should take form (d: T) => string;

  constructor(filterFunction: Function, keyFunction: Function) {
    this.coveredRanges = [];
    this.cache = {};
    this.filterFunction = filterFunction;
    this.keyFunction = keyFunction;
  }

  // gets data from cache at the Resolution defined by the interval
  get(range: ContigInterval<string>): T[] {
    if (this.coversRange(range)) {
      if (!range) return [];
      return _.filter(this.cache, d => this.filterFunction(range, d));
    } else {
      return [];
    }
  }

  // puts new ranges into list of ranges covered by cache
  coverRange(range: ContigInterval<string>) {
    var resolution = ResolutionCache.getResolution(range.interval);
    var resolvedRange = new ResolutionCacheKey(range, resolution);
    this.coveredRanges.push(resolvedRange);
    // coalesce new contigIntervals
    this.coveredRanges = ResolutionCacheKey.coalesce(this.coveredRanges);
  }

  // puts data in cache
  put(value: T) {
    var key = this.keyFunction(value);
    if (!this.cache[key]) {
      this.cache[key] = value;
    }
  }

  // checks weather cache contains data for the
  // specified interval and its corresponding resolution
  coversRange(range: ContigInterval<string>): boolean {
    var resolution = ResolutionCache.getResolution(range.interval);
    if (range.isCoveredBy(this.coveredRanges.map(r => r.contigInterval))) {
      // if covered by the data, verify that the correct base pair density is
      // available
      var correctResolution = true;
      for (var i = 0; i < this.coveredRanges.length; i++) {
        var r: ContigInterval<string> = this.coveredRanges[i].contigInterval;
        var thisRes = this.coveredRanges[i].resolution;
        if (r.intersects(range)) {
          if (thisRes > resolution) { // resolution not fine enough for query
            correctResolution = false;
            break;
          }
        }
      }
      return correctResolution;
    } else {
      return false;
    }
  }

  // clears out all content in cache
  clear() {
    this.coveredRanges = [];
    this.cache = {};
  }

  /**
   * Gets the Base Pairs per bin given a specified interval
   * This is used to bin coverage when viewing large regions
   *
   * Values were chosen based on a 1000 pixel screen (a conservative estimate):
   * - For regions < 10,000 base pairs, no binning is performed (return 1)
   * - For regions >= 10,000 and < 100,000, bin 10 bp into 1 (return 10)
   * - For regions >= 100,000 and < 1,000,000, bin 100 bp into 1 (return 100)
   * - For regions >= 1,000,000, bin 1000 bp into 1 (return 1000)
   */
  static getResolution(range: Interval): number {
    if (range.length() < 10000)
      return 1;
    else if (range.length() >= 10000 && range.length() < 100000 )
      return 10;
    else if (range.length() >= 100000 && range.length() < 1000000 )
      return 100;
    else
      return 1000;
  }
}

/**
 * Class holds a ContigInterval and resolution that designates whether
 * a contig interval represents data at a certain resolution. The
 * parameters for choosing a resolution based on interval length are set
 * in getResolution.
 *
 */
class ResolutionCacheKey {
  contigInterval: ContigInterval<string>;
  resolution: number;

  constructor(contigInterval: ContigInterval<string>, resolution: number) {
    this.contigInterval = contigInterval;
    this.resolution = resolution;
  }

  clone(): ResolutionCacheKey {
    return new ResolutionCacheKey(this.contigInterval.clone(), this.resolution);
  }

  // Sort an array of intervals & coalesce adjacent/overlapping ranges.
  // NB: this may re-order the intervals parameter
  static coalesce(intervals: ResolutionCacheKey[]): ResolutionCacheKey[] {
    intervals.sort(ResolutionCacheKey.compare);

    var rs = [];
    intervals.forEach(r => {
      if (rs.length === 0) {
        rs.push(r);
        return;
      }

      var lastR: ResolutionCacheKey = rs[rs.length - 1];
      if (r.contigInterval.intersects(lastR.contigInterval) ||
          r.contigInterval.isAdjacentTo(lastR.contigInterval) &&
          r.resolution == lastR.resolution) {
        lastR = rs[rs.length - 1] = lastR.clone();
        lastR.contigInterval.interval.stop =
          Math.max(r.contigInterval.interval.stop, lastR.contigInterval.interval.stop);
      } else {
        rs.push(r);
      }
    });

    return rs;
  }

  // Comparator for use with Array.prototype.sort
  static compare(a: ResolutionCacheKey, b: ResolutionCacheKey): number {
    if (a.contigInterval.contig > b.contigInterval.contig) {
      return -1;
    } else if (a.contigInterval.contig < b.contigInterval.contig) {
      return +1;
    } else {
      return a.contigInterval.start() - b.contigInterval.start();
    }
  }

}

module.exports = {
  ResolutionCache
};

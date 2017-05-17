/* @flow */
'use strict';

import Interval from './Interval';
import {flatMap} from './utils';

/**
 * Class representing a closed interval on the genome: contig:start-stop.
 *
 * The contig may be either a string ("chr22") or a number (in case the contigs
 * are indexed, for example).
 */
class ContigInterval<T: (number|string)> {
  contig: T;
  interval: Interval;

  constructor(contig: T, start: number, stop: number) {
    if (typeof contig === 'string' || contig instanceof String) {
      this.contig = contig.replace(/chr/, '');
    }
    else {
      this.contig = contig;
    }
    this.interval = new Interval(start, stop);
  }

  // TODO: make these getter methods & switch to Babel.
  start(): number {
    return this.interval.start;
  }
  stop(): number {
    return this.interval.stop;
  }
  length(): number {
    return this.interval.length();
  }

  intersects(other: ContigInterval<T>): boolean {
    return (this.contig === other.contig &&
            this.interval.intersects(other.interval));
  }

  // Like intersects(), but allows 'chr17' vs. '17'-style mismatches.
  chrIntersects(other: ContigInterval<T>): boolean {
    return (this.chrOnContig(other.contig) &&
            this.interval.intersects(other.interval));
  }

  containsInterval(other: ContigInterval<T>): boolean {
    return (this.contig === other.contig &&
            this.interval.containsInterval(other.interval));
  }

  isAdjacentTo(other: ContigInterval<T>): boolean {
    return (this.contig === other.contig &&
            (this.start() == 1 + other.stop() ||
             this.stop() + 1 == other.start()));
  }

  isCoveredBy(intervals: ContigInterval<T>[]): boolean {
    var ivs = intervals.filter(iv => iv.contig === this.contig)
                       .map(iv => iv.interval);
    return this.interval.isCoveredBy(ivs);
  }

  containsLocus(contig: T, position: number): boolean {
    return this.contig === contig &&
           this.interval.contains(position);
  }

  // Like containsLocus, but allows 'chr17' vs '17'-style mismatches
  chrContainsLocus(contig: T, position: number): boolean {
    return this.chrOnContig(contig) &&
           this.interval.contains(position);
  }

  // Is this read on the given contig? (allowing for chr17 vs 17-style mismatches)
  chrOnContig(contig: T): boolean {
    return (this.contig === contig || this.contig === 'chr' + contig || 'chr' + this.contig === contig);
  }

  clone(): ContigInterval<T> {
    return new ContigInterval(this.contig, this.interval.start, this.interval.stop);
  }

  /**
   * Similar to Interval.complementIntervals, but only considers those intervals
   * on the same contig as this one.
   */
  complementIntervals(intervals: ContigInterval<T>[]): ContigInterval<T>[] {
    return this.interval.complementIntervals(
        flatMap(intervals, ci => ci.contig === this.contig ? [ci.interval] : []))
        .map(iv => new ContigInterval(this.contig, iv.start, iv.stop));
  }

  /*
  This method doesn't typecheck. See https://github.com/facebook/flow/issues/388
  isAfterInterval(other: ContigInterval): boolean {
    return (this.contig > other.contig ||
            (this.contig === other.contig && this.start() > other.start()));
  }
  */

  toString(): string {
    return `${this.contig}:${this.start()}-${this.stop()}`;
  }

  toGenomeRange(): GenomeRange {
    if (!(typeof this.contig === 'string' || this.contig instanceof String)) {
      throw 'Cannot convert numeric ContigInterval to GenomeRange';
    }
    return {
      contig: this.contig,
      start: this.start(),
      stop: this.stop()
    };
  }

  // Comparator for use with Array.prototype.sort
  static compare(a: ContigInterval, b: ContigInterval): number {
    if (a.contig > b.contig) {
      return -1;
    } else if (a.contig < b.contig) {
      return +1;
    } else {
      return a.start() - b.start();
    }
  }

  // Sort an array of intervals & coalesce adjacent/overlapping ranges.
  // NB: this may re-order the intervals parameter
  static coalesce(intervals: ContigInterval[]): ContigInterval[] {
    intervals.sort(ContigInterval.compare);

    var rs = [];
    intervals.forEach(r => {
      if (rs.length === 0) {
        rs.push(r);
        return;
      }

      var lastR = rs[rs.length - 1];
      if (r.intersects(lastR) || r.isAdjacentTo(lastR)) {
        lastR = rs[rs.length - 1] = lastR.clone();
        lastR.interval.stop = Math.max(r.interval.stop, lastR.interval.stop);
      } else {
        rs.push(r);
      }
    });

    return rs;
  }

  static fromGenomeRange(range: GenomeRange): ContigInterval<string> {
    return new ContigInterval(range.contig, range.start, range.stop);
  }
}

module.exports = ContigInterval;

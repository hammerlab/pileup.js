/**
 * Class representing a closed numeric interval, [start, stop].
 *
 * @flow
 */

"use strict";

class Interval {
  start: number;
  stop: number;
  end: number;

  // Represents [start, stop] -- both ends are inclusive.
  // If stop < start, then this is an empty interval.
  constructor(start: number, stop: number) {
    this.start = start;
    this.stop = stop;
    this.end = stop + 1;
  }

  // TODO: make this a getter method & switch to Babel.
  length(): number {
    return Math.max(0, this.end - this.start);
  }

  isEmpty(): bool {
    return this.length() == 0
  }

  intersect(other: Interval): Interval {
    return new Interval(Math.max(this.start, other.start),
                        Math.min(this.end, other.end));
  }

  intersects(other: Interval): boolean {
    return this.start < other.end && other.start < this.end;
  }

  contains(value: number): boolean {
    return value >= this.start && value < this.end;
  }

  containsInterval(other: Interval): boolean {
    return this.contains(other.start) && this.contains(other.stop);
  }

  clone(): Interval {
    return new Interval(this.start, this.stop);
  }

  /**
   * Is this Interval entirely covered by the union of the ranges?
   * The ranges parameter must be sorted by range.start
   */
  isCoveredBy(ranges: Interval[]): boolean {
    var remaining = this.clone();
    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      if (i && r.start < ranges[i - 1].start) {
        throw 'isCoveredBy must be called with sorted ranges';
      }
      if (r.start > remaining.start) {
        return false;  // A position has been missed and there's no going back.
      }
      remaining.start = r.end;
      if (remaining.length() <= 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find the subintervals which are not in `other`.
   * This can yield either zero, one or two Intervals.
   */
  subtract(other: Interval): Interval[] {
    if (!this.intersects(other)) {
      return [this];  // unaffected by this range
    } else if (this.containsInterval(other)) {
      // return the bit before and the bit after
      return [new Interval(this.start, other.start - 1),
              new Interval(other.end, this.stop)].filter(x => x.length() > 0);
    } else if (other.containsInterval(this)) {
      return [];  // it's been completely obliterated
    } else {
      // it overlaps one end
      if (other.start < this.start) {
        return [new Interval(other.stop + 1, this.stop)];
      } else {
        return [new Interval(this.start, other.start - 1)];
      }
    }
  }

  /**
   * Find the disjoint subintervals not covered by any interval in the list.
   *
   * If comp = interval.complementIntervals(ranges), then this guarantees that:
   * - comp union ranges = interval
   * - a int b = 0 forall a \in comp, b in ranges
   *
   * (The input ranges need not be disjoint.)
   */
  complementIntervals(ranges: Interval[]): Interval[] {
    var comps = [this];
    ranges.forEach(range => {
      var newComps = [];
      comps.forEach(iv => {
        newComps = newComps.concat(iv.subtract(range));
      });
      comps = newComps;
    });
    return comps;
  }

  static intersectAll(intervals: Array<Interval>): Interval {
    if (!intervals.length) {
      throw new Error('Tried to intersect zero intervals');
    }

    var start = intervals[0].start;
    var stop = intervals[0].stop;
    intervals.slice(1).forEach(iv => {
      start = Math.max(iv.start, start);
      stop = Math.min(iv.stop, stop);
    });
    return new Interval(start, stop);
  }

  // Returns an interval which contains all the given intervals.
  static boundingInterval(intervals: Array<Interval>): Interval {
    if (!intervals.length) {
      throw new Error('Tried to bound zero intervals');
    }

    var start = intervals[0].start;
    var stop = intervals[0].stop;
    intervals.slice(1).forEach(iv => {
      start = Math.min(iv.start, start);
      stop = Math.max(iv.stop, stop);
    });
    return new Interval(start, stop);
  }

  static partition(interval: Interval, 
                   bases: Array<number>, 
                   baseIdx: number): Array<Interval> {
    if (typeof bases === 'number') {
      var n = bases;
      var c = 1;
      bases = [];
      var length = interval.length();
      while (true) {
        if (c > length) break;
        var s = Math.ceil(interval.start / c);
        var e = Math.floor(interval.end / c);
        if (s < e) {
          bases.push(c);
          c *= n;
          if (n == 1) break;
        } else {
          break;
        }
      }
      return Interval.partition(interval, bases, bases.length - 1);
    }

    if (interval.isEmpty()) {
      return [];
    }

    if (baseIdx === undefined) {
      baseIdx = bases.length - 1
    }
    
    if (baseIdx < 0) {
      throw new Error("Ran out of partition bases: " + bases.join(",") + " with remaining interval: " + interval.toString());
    }

    var base = bases[baseIdx];

    // Compute lowest and highest contained multiples of `base`, if any exist.
    // If none exist, the former can be ≥ `this.end` and the latter < `this.start`.
    // For example, the interval [15,17), with base 10, contains no multiples of 10 and the bounds generated here will
    // be 20 and 10, resp.
    var baseStart = Math.ceil(interval.start / base) * base;
    var baseEnd = Math.floor(interval.end / base) * base;

    // We can only pull an interval of size `base` (whose bounds are multiples of `base`) out of `interval` if
    // `baseStart` < `baseEnd`. Otherwise, we no-op at this `base` and try the next, smaller `base` value.
    if (baseStart >= baseEnd) {
      return Interval.partition(interval, bases, baseIdx - 1);
    }

    var leftRemnant = new Interval(interval.start, baseStart - 1);
    var intervals = Interval.partition(leftRemnant, bases, baseIdx - 1);

    for (var baseBucket = baseStart; baseBucket < baseEnd; baseBucket += base) {
      intervals.push(new Interval(baseBucket, baseBucket + base - 1));
    }

    var rightRemnant = new Interval(baseEnd, interval.stop);
    var rightPartition = Interval.partition(rightRemnant, bases, baseIdx - 1);

    var ret = intervals.concat(rightPartition);
    // console.log("returning:", ret.join(','));
    return ret;
  }

  toString(): string {
    return `[${this.start}, ${this.end})`;
  }
}

module.exports = Interval;

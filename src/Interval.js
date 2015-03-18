/**
 * Class representing a closed numeric interval, [start, stop].
 *
 * @flow
 */
class Interval {
  start: number;
  stop: number;

  // Represents [start, stop] -- both ends are inclusive.
  // If stop < start, then this is an empty interval.
  constructor(start: number, stop: number) {
    this.start = start;
    this.stop = stop;
  }

  // TODO: make this a getter method & switch to Babel.
  length(): number {
    return Math.max(0, this.stop - this.start + 1);
  }

  intersect(other: Interval): Interval {
    return new Interval(Math.max(this.start, other.start),
                        Math.min(this.stop, other.stop));
  }

  intersects(other: Interval): boolean {
    return this.start <= other.stop && other.start <= this.stop;
  }

  contains(value: number): boolean {
    return value >= this.start && value <= this.stop;
  }

  containsInterval(other: Interval): boolean {
    return this.contains(other.start) && this.contains(other.stop);
  }

  clone(): Interval {
    return new Interval(this.start, this.stop);
  }

  static intersectAll(intervals: Array<Interval>): Interval {
    if (!intervals.length) {
      throw new Error('Tried to intersect zero intervals');
    }
    var result = intervals[0].clone();
    intervals.slice(1).forEach(function({start, stop}) {
      result.start = Math.max(start, result.start);
      result.stop = Math.min(stop, result.stop);
    });
    return result;
  }

  // Returns an interval which contains all the given intervals.
  static boundingInterval(intervals: Array<Interval>): Interval {
    if (!intervals.length) {
      throw new Error('Tried to bound zero intervals');
    }
    var result = intervals[0].clone();
    intervals.slice(1).forEach(function({start, stop}) {
      result.start = Math.min(start, result.start);
      result.stop = Math.max(stop, result.stop);
    });
    return result;
  }

  toString(): string {
    return `[${this.start}, ${this.stop}]`;
  }
}

module.exports = Interval;

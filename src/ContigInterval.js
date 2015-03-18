/* @flow */

var Interval = require('./Interval');

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
    this.contig = contig;
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

  toString(): string {
    return `${this.contig}:${this.start()}-${this.stop()}`;
  }
}

module.exports = ContigInterval;

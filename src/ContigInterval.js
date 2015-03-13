/* @flow */

var Interval = require('./Interval');

/**
 * Class representing a closed interval on the genome: contig:start-stop.
 *
 * The contig may be either a string ("chr22") or a number (in case the contigs
 * are indexed, for example).
 */
class ContigInterval {
  contig: string|number;
  interval: Interval;

  constructor(contig: string|number, start: number, stop: number) {
    this.contig = contig;
    this.interval = new Interval(start, stop);
  }

  // TODO: make these getter methods & switch to Babel.
  start() {
    return this.interval.start;
  }
  stop() {
    return this.interval.stop;
  }
  length() {
    return this.interval.length();
  }

  intersects(other) {
    return (this.contig == other.contig &&
            this.interval.intersects(other.interval));
  }

  toString() {
    return `${this.contig}:${this.start()}-${this.stop()}`;
  }
}

module.exports = ContigInterval;

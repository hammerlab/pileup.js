/**
 * Grab-bag of utility functions.
 * @flow
 */
'use strict';

import type {InflatedBlock, PartialGenomeRange} from './types';
import type Q from 'q';

import pako from 'pako/lib/inflate';
import _ from 'underscore';

import Interval from './Interval';

// Compare two tuples of equal length. Is t1 <= t2?
// TODO: make this tupleLessOrEqual<T> -- it works with strings or booleans, too.
function tupleLessOrEqual(t1: Array<number>, t2: Array<number>): boolean {
  if (t1.length != t2.length) throw new Error('Comparing non-equal length tuples');
  for (var i = 0; i < t1.length; i++) {
    if (t1[i] > t2[i]) {
      return false;
    } else if (t1[i] < t2[i]) {
      return true;
    }
  }
  return true;
}

// Do two ranges of tuples overlap?
// TODO: make this tupleRangeOverlaps<T> -- it works with strings or booleans, too.
function tupleRangeOverlaps(tupleRange1: Array<Array<number>>,
                            tupleRange2: Array<Array<number>>): boolean {
  return (
     // Are the ranges overlapping?
     tupleLessOrEqual(tupleRange1[0], tupleRange2[1]) &&
     tupleLessOrEqual(tupleRange2[0], tupleRange1[1]) &&
     // ... and non-empty?
     tupleLessOrEqual(tupleRange1[0], tupleRange1[1]) &&
     tupleLessOrEqual(tupleRange2[0], tupleRange2[1]));
}

// Return a new ArrayBuffer by concatenating an array of ArrayBuffers.
function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  var totalBytes = buffers.map(b => b.byteLength).reduce((a, b) => a + b, 0);
  var output = new Uint8Array(totalBytes);
  var position = 0;
  buffers.forEach(buf => {
    output.set(new Uint8Array(buf), position);
    position += buf.byteLength;
  });
  return output.buffer;
}

type InflateCacheKey = {
  filename: string;
  initialOffset: number;
}

type PakoResult = {
  err: number;
  msg: string;
  buffer: ?ArrayBuffer;
  total_in: number;
}
var inflationCache: {[key: string]: PakoResult} = {};

// extracted for caching
function _inflateOne(buffer, position): PakoResult {
  var inflator = new pako.Inflate();
  inflator.push(buffer.slice(position));
  return {
    err: inflator.err,
    msg: inflator.msg,
    buffer: inflator.result ? inflator.result.buffer : null,
    total_in: inflator.strm.total_in
  };
}

function cachedInflateOne(buffer, position, cache?: InflateCacheKey) {
  if (!cache) {
    return _inflateOne(buffer, position);
  }
  var cacheKey = cache.filename + ':' + (cache.initialOffset + position);
  var v = inflationCache[cacheKey];
  if (v && (position + v.total_in > buffer.byteLength)) {
    // It should fail.
    return _inflateOne(buffer, position);
  }

  if (!v) {
    v = _inflateOne(buffer, position);
  }
  if (!v.err && v.buffer) {
    inflationCache[cacheKey] = v;
  }
  return v;
}

/**
 * BAM files are written in "BGZF" format, which consists of many concatenated
 * gzip blocks. gunzip concatenates all the inflated blocks, but pako only
 * inflates one block at a time. This wrapper makes pako behave like gunzip.
 * If specified, lastBlockStart will stop inflation before all the blocks
 * have been processed.
 */
function inflateConcatenatedGzip(buffer: ArrayBuffer,
                                 lastBlockStart?: number,
                                 cache?: InflateCacheKey): InflatedBlock[] {
  var position = 0,
      blocks = [];
  if (lastBlockStart === undefined) {
    lastBlockStart = buffer.byteLength;
  }
  do {
    var result = cachedInflateOne(buffer, position, cache);

    if (result.err) {
      throw 'Gzip error: ' + result.msg;
    }
    if (result.buffer) {
      blocks.push({
        offset: position,
        compressedLength: result.total_in,
        buffer: result.buffer
      });
    }
    position += result.total_in;
  } while (position <= lastBlockStart && position < buffer.byteLength);
  return blocks;
}

/**
 * Inflate one or more gzip blocks in the buffer.
 * Returns the concatenation of all inflated blocks.
 * This mirrors the behavior of gzip(1).
 */
function inflateGzip(buffer: ArrayBuffer): ArrayBuffer {
  return concatArrayBuffers(inflateConcatenatedGzip(buffer).map(x => x.buffer));
}

// Given 'chr9', return '9'. Given '9', return 'chr9'.
function altContigName(contig: string): string {
  if (contig.slice(0, 3) == 'chr') {
    return contig.slice(3);
  } else {
    return 'chr' + contig;
  }
}

// Are two strings equal module a 'chr' prefix?
// e.g. isChrMatch('17', 'chr17') == true
function isChrMatch(a: string, b: string): boolean {
  return a == b || 'chr' + a == b || a == 'chr' + b;
}

/**
 * Pipe all promise events through a deferred object.
 * This is similar to deferred.resolve(promise), except that it allows progress
 * notifications from the promise to bubble through.
 */
function pipePromise<T>(deferred: Q.Deferred<T>, promise: Q.Promise<T>) {
  promise.then(deferred.resolve, deferred.reject, deferred.notify);
}

/**
 * Scale the range by `factor` about its center.
 * factor 2.0 will produce a range with twice the span, 0.5 with half.
 * An invariant is that the center value will be identical before and after.
 */
function scaleRange(range: Interval, factor: number): Interval {
  var span = range.stop - range.start,
      center = Math.floor((range.start + range.stop) / 2),
      newSpan = Math.round(factor * span / 2) * 2,
      start = center - newSpan / 2,
      stop = center + newSpan / 2;  // TODO: clamp

  if (start < 0) {
    // Shift to the right so that the range starts at zero.
    stop -= start;
    start = 0;
  }
  return new Interval(start, stop);
}

/**
 * Parse a user-specified range into a range.
 * Only the specified portions of the range will be filled out in the returned object.
 * For example:
 * 'chr17' --> {contig:'chr17'}
 * '10-20' --> {start: 10, stop: 20}
 * '17:10-20' --> {contig: '17', start: 10, stop: 20}
 * Returns null if the range can't be parsed.
 */
function parseRange(range: string): ?PartialGenomeRange {
  // First try 'contig:start-stop'
  var m = /^([^ :]+):([0-9,]+)-([0-9,]+)$/.exec(range);
  if (m) {
    return {
      contig: m[1],
      start: parseNumberWithCommas(m[2]),
      stop: parseNumberWithCommas(m[3])
    };
  }

  // Then contig:number
  m = /^([^ :]+):([0-9,]+)$/.exec(range);
  if (m) {
    return {
      contig: m[1],
      start: parseNumberWithCommas(m[2]),
    };
  }

  // Then 'start:stop'
  m = /^([0-9,]+)-([0-9,]+)$/.exec(range);
  if (m) {
    return {
      start: parseNumberWithCommas(m[1]),
      stop: parseNumberWithCommas(m[2])
    };
  }

  // Then 'contig:' or non-numeric 'contig'
  m = /^([^ :]+):$/.exec(range) || /^([^0-9][^ :]+)$/.exec(range);
  if (m) {
    return { contig: m[1] };
  }

  // Then plain-old numbers.
  m = /^([0-9,]+)$/.exec(range);
  if (m) {
    return { start: parseNumberWithCommas(m[1]) };
  }


  return null;
}

function formatInterval(iv: Interval): string {
  return numberWithCommas(iv.start) + '-' + numberWithCommas(iv.stop);
}

// See http://stackoverflow.com/a/2901298/388951
function numberWithCommas(x: number): string {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseNumberWithCommas(x: string): number {
  return parseInt(x.replace(/,/g, ''), 10);
}

function flatMap<T, R>(array: T[], fn: (t: T)=>R[]): R[] {
  return _.flatten(array.map(fn), true /* shallow */);
}

/**
 * Determine the percentile-th element of xs.
 * percentile should be an integer from 1 to 99.
 * This will sort the xs.
 */
function computePercentile(xs: number[], percentile: number): number {
  if (xs.length === 0) return 0;  // placeholder value

  xs.sort((a, b) => a - b);
  var idx = (xs.length - 1) * percentile / 100,
      lo = Math.floor(idx),
      hi = Math.ceil(idx);

  if (lo == hi) {
    return xs[lo];
  } else {
    return xs[lo] * (idx - lo) + xs[hi] * (hi - idx);
  }
}

/**
 * Converts a string into a null, NaN, undefined, Inf or -Inf. Returns
 * original string if string is not a special case.
 * Returns string parsed to special case (null, NaN, undefined, Inf or -Inf)
 * or original string.
 */
function stringToLiteral(value: string): any {
  var maps = {
   "NaN": NaN,
   "null": null,
   "undefined": undefined,
   "Infinity": Infinity,
   "-Infinity": -Infinity
   };
  return ((value in maps) ? maps[value] : value);
}

module.exports = {
  tupleLessOrEqual,
  tupleRangeOverlaps,
  concatArrayBuffers,
  inflateConcatenatedGzip,
  inflateGzip,
  altContigName,
  pipePromise,
  scaleRange,
  parseRange,
  formatInterval,
  isChrMatch,
  flatMap,
  computePercentile,
  stringToLiteral
};

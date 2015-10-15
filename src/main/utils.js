/**
 * Grab-bag of utility functions.
 * @flow
 */
'use strict';

import type {InflatedBlock} from './types';
import type * as Q from 'q';

var pako = require('pako/lib/inflate');

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

/**
 * Pipe all promise events through a deferred object.
 * This is similar to deferred.resolve(promise), except that it allows progress
 * notifications from the promise to bubble through.
 */
function pipePromise<T>(deferred: Q.Deferred<T>, promise: Q.Promise<T>) {
  promise.then(deferred.resolve, deferred.reject, deferred.notify);
}

module.exports = {
  tupleLessOrEqual,
  tupleRangeOverlaps,
  concatArrayBuffers,
  inflateConcatenatedGzip,
  inflateGzip,
  altContigName,
  pipePromise
};

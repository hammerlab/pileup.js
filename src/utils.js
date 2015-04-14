/**
 * Grab-bag of utility functions.
 * @flow
 */
'use strict';

var pako = require('pako');

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

type InflatedBlock = {
  offset: number;
  compressedLength: number;
  buffer: ArrayBuffer;
}

/**
 * BAM files are written in "BGZF" format, which consists of many concatenated
 * gzip blocks. gunzip concatenates all the inflated blocks, but pako only
 * inflates one block at a time. This wrapper makes pako behave like gunzip.
 * If specified, lastBlockStart will stop inflation before all the blocks
 * have been processed.
 */
function inflateConcatenatedGzip(buffer: ArrayBuffer, lastBlockStart?: number): InflatedBlock[] {
  var position = 0,
      blocks = [],
      inflator;
  if (lastBlockStart === undefined) {
    lastBlockStart = buffer.byteLength;
  }
  do {
    inflator = new pako.Inflate();
    inflator.push(buffer.slice(position));
    if (inflator.err) { throw inflator.msg; }
    if (inflator.result) {
      blocks.push({
        offset: position,
        compressedLength: inflator.strm.total_in,
        buffer: inflator.result.buffer
      });
    }
    position += inflator.strm.total_in;
  } while (inflator.strm.avail_in > 0 && position <= lastBlockStart);
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

module.exports = {tupleLessOrEqual, tupleRangeOverlaps, concatArrayBuffers, inflateConcatenatedGzip, inflateGzip};

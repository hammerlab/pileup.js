/**
 * A store for sequences.
 *
 * This is used to store and retrieve reference data.
 *
 * @flow
 */
'use strict';

import type Interval from './Interval';
import type ContigInterval from './ContigInterval';

import _ from 'underscore';

import {altContigName} from './utils';

// Store sequences of this many base pairs together in a single string.
const CHUNK_SIZE = 1000;

type SeqMap = {[key: number]: string};
type ChunkWithOffset = {
  chunkStart: number;
  offset: number;
  length: number;
};

// This class stores sequences efficiently.
class SequenceStore {
  // contig --> start of chunk --> sequence of chunk
  contigMap: {[key: string]: SeqMap};

  constructor() {
    this.contigMap = {};
  }

  /**
   * Set a range of the genome to the particular sequence.
   * This overwrites any existing data.
   */
  setRange(range: ContigInterval<string>, sequence: string) {
    if (range.length() === 0) return;
    if (range.length() != sequence.length) {
      throw 'setRange length mismatch';
    }

    var seqs = this._getSequences(range.contig);
    if (!seqs) {
      seqs = this.contigMap[range.contig] = {};
    }

    for (var chunk of this._chunkForInterval(range.interval)) {
      var pos = chunk.chunkStart + chunk.offset - range.start();
      this._setChunk(seqs, chunk, sequence.slice(pos, pos + chunk.length));
    }
  }

  /**
   * Retrieve a range of sequence data.
   * If any portions are unknown, they will be set to '.'.
   */
  getAsString(range: ContigInterval<string>): string {
    const seqs = this._getSequences(range.contig);
    if (!seqs) {
      return '.'.repeat(range.length());
    }

    var chunks = this._chunkForInterval(range.interval);
    var result = '';
    for (var chunk of chunks) {
      var seq = seqs[chunk.chunkStart];
      if (!seq) {
        result += '.'.repeat(chunk.length);
      } else if (chunk.offset === 0 && chunk.length == seq.length) {
        result += seq;
      } else {
        result += seq.slice(chunk.offset, chunk.offset + chunk.length);
      }
    }
    return result;
  }

  /**
   * Like getAsString(), but returns a less efficient object representation:
   * {'chr1:10': 'A', 'chr1:11': 'C', ...}
   */
  getAsObjects(range: ContigInterval<string>): {[key:string]: ?string} {
    return _.object(_.map(this.getAsString(range),
                          (base, i) => [range.contig + ':' + (range.start() + i),
                                        base == '.' ? null : base]));
  }

  // Retrieve a chunk from the sequence map.
  _getChunk(seqs: SeqMap, start: number): string {
    return seqs[start] || '.'.repeat(CHUNK_SIZE);
  }

  // Split an interval into chunks which align with the store.
  _chunkForInterval(range: Interval): ChunkWithOffset[] {
    var offset = range.start % CHUNK_SIZE,
        chunkStart = range.start - offset;
    var chunks = [{
      chunkStart,
      offset,
      length: Math.min(CHUNK_SIZE - offset, range.length())
    }];
    chunkStart += CHUNK_SIZE;
    for (; chunkStart <= range.stop; chunkStart += CHUNK_SIZE) {
      chunks.push({
        chunkStart,
        offset: 0,
        length: Math.min(CHUNK_SIZE, range.stop - chunkStart + 1)
      });
    }
    return chunks;
  }

  // Set a (subset of a) chunk to the given sequence.
  _setChunk(seqs: SeqMap, chunk: ChunkWithOffset, sequence: string) {
    // First: the easy case. Total replacement.
    if (chunk.offset === 0 && sequence.length == CHUNK_SIZE) {
      seqs[chunk.chunkStart] = sequence;
      return;
    }

    // We need to merge the new sequence with the old.
    var oldChunk = this._getChunk(seqs, chunk.chunkStart);
    seqs[chunk.chunkStart] = oldChunk.slice(0, chunk.offset) +
                       sequence +
                       oldChunk.slice(chunk.offset + sequence.length);
  }

  // Get the sequences for a contig, allowing chr- mismatches.
  _getSequences(contig: string): ?SeqMap {
    return this.contigMap[contig] ||
           this.contigMap[altContigName(contig)] ||
           null;
  }
}

module.exports = SequenceStore;

/** @flow */
'use strict';

import type SamRead from '../data/SamRead';
import type {Alignment, CigarSymbol} from '../Alignment';
import type Interval from '../Interval';

/**
 * Given a list of Intervals, return a parallel list of row numbers for each.
 * Assuming rows = pileup(reads), then your guarantee is that
 * rows[i] == rows[j] => !reads[i].intersects(reads[j])
 */
function pileup(reads: Interval[]): number[] {
  var rows = new Array(reads.length),
      lastReads = [];  // row number --> last Interval in that row

  // For each read, find the first row that it will fit in.
  // This is potentially O(n^2) in the number of reads; there's probably a
  // better way.
  for (var i = 0; i < reads.length; i++) {
    var r = reads[i];
    var rowNum = lastReads.length;
    for (var j = 0; j < lastReads.length; j++) {
      if (!r.intersects(lastReads[j])) {
        rowNum = j;
        break;
      }
    }
    rows[i] = rowNum;
    lastReads[rowNum] = r;
  }

  return rows;
}

/**
 * Add a read to an existing pileup.
 * pileup maps {row --> reads in that row}
 * This modifies pileup by inserting the read in the appropriate row.
 * Returns the chosen row number.
 */
function addToPileup(read: Interval, pileup: Array<Interval[]>): number {
  var chosenRow = -1;
  for (var i = 0; i < pileup.length; i++) {
    var reads = pileup[i];
    var ok = true;
    for (var j = 0; j < reads.length; j++) {
      if (reads[j].intersects(read)) {
        ok = false;
        break;
      }
    }

    if (ok) {
      chosenRow = i;
      break;
    }
  }

  if (chosenRow == -1) {
    chosenRow = pileup.length;
    pileup[chosenRow] = [];  // go deeper
  }

  pileup[chosenRow].push(read);
  return chosenRow;
}

export type BasePair = {
  pos: number;
  basePair: string;
  quality: number;
}

function findMismatches(reference: string, seq: string, refPos: number, scores: number[]): BasePair[] {
  var out = [];
  for (var i = 0; i < seq.length; i++) {
    var pos = refPos + i,
        ref = reference.charAt(i),
        basePair = seq.charAt(i);
    if (ref != basePair && ref != '.') {
      out.push({
        pos,
        basePair,
        quality: scores[i]
      });
    }
  }
  return out;
}

// Determine which alignment segment to render as an arrow.
// This is either the first or last 'M' section, excluding soft clipping.
function getArrowIndex(read: Alignment): number {
  var i, op, ops = read.cigarOps;
  if (read.getStrand() == '-') {
    for (i = 0; i < ops.length; i++) {
      op = ops[i];
      if (op.op == 'S') continue;
      if (op.op == 'M') return i;
      return -1;
    }
  } else {
    for (i = ops.length - 1; i >= 0; i--) {
      op = ops[i];
      if (op.op == 'S') continue;
      if (op.op == 'M') return i;
      return -1;
    }
  }
  return -1;
}

// The comments below come from the SAM spec
var CigarOp = {
  MATCH: 'M',  // alignment match (can be a sequence match or mismatch)
  INSERT: 'I',  // insertion to the reference
  DELETE: 'D',  // deletion from the reference
  SKIP: 'N',  // skipped region from the reference
  SOFTCLIP: 'S',  // soft clipping (clipped sequences present in SEQ)
  HARDCLIP: 'H',  // hard clipping (clipped sequences NOT present in SEQ)
  PADDING: 'P',  // padding (silent deletion from padded reference)
  SEQMATCH: '=',  // sequence match
  SEQMISMATCH: 'X'  // sequence mismatch
};

type Op = {
  op: CigarSymbol;
  length: number;
  pos: number;
  arrow: ?('L'|'R');
}

export type OpInfo = {
  ops: Op[],
  mismatches: BasePair[]
}

// Breaks the read down into Cigar Ops suitable for display
function getOpInfo(read: Alignment, referenceSource: Object): OpInfo {
  var ops = read.cigarOps;

  var range = read.getInterval(),
      start = range.start(),
      seq = read.getSequence(),
      scores = read.getQualityScores(),
      seqPos = 0,
      refPos = start,
      arrowIndex = getArrowIndex(read);

  var result = [];
  var mismatches = ([]: BasePair[]);
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    if (op.op == 'M') {
      var ref = referenceSource.getRangeAsString({
        contig: range.contig,
        start: refPos,
        stop: refPos + op.length - 1
      });
      var mSeq = seq.slice(seqPos, seqPos + op.length);
      mismatches = mismatches.concat(findMismatches(ref, mSeq, refPos, scores));
    }

    result.push({
      op: op.op,
      length: op.length,
      pos: refPos,
      qpos: seqPos,
      arrow: null
    });

    // These are the cigar operations which advance position in the reference
    switch (op.op) {
      case CigarOp.MATCH:
      case CigarOp.DELETE:
      case CigarOp.SKIP:
      case CigarOp.SEQMATCH:
      case CigarOp.SEQMISMATCH:
        refPos += op.length;
    }

    // These are the cigar operations which advance the per-alignment sequence.
    switch (op.op) {
      case CigarOp.MATCH:
      case CigarOp.INSERT:
      case CigarOp.SOFTCLIP:
      case CigarOp.SEQMATCH:
      case CigarOp.SEQMISMATCH:
        seqPos += op.length;
    }

  }

  if (arrowIndex >= 0) {
    result[arrowIndex].arrow = read.getStrand() == '-' ? 'L' : 'R';
  }

  return {
    ops: result,
    mismatches
  };
}

module.exports = {
  pileup,
  addToPileup,
  getOpInfo,
  CigarOp
};

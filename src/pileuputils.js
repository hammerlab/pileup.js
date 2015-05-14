/** @flow */
'use strict';

import type * as SamRead from './SamRead';
import type * as Interval from './Interval';

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

type BasePair = {
  pos: number;
  basePair: string;
}

function getDifferingBasePairs(read: SamRead, reference: string): Array<BasePair> {
  var cigar = read.getCigarOps();

  if (read.getName() == 'cb9b557a-3fdc-47c5-9651-825afb4f0d25') {
    console.log(reference);
  }

  // TODO: account for Cigars with clipping and indels
  if (cigar.length != 1 || cigar[0].op != 'M') {
    return [];
  }
  var range = read.getInterval(),
      seq = read.getSequence(),
      start = range.start();
  var out = [];
  for (var i = 0; i < seq.length; i++) {
    var pos = start + i,
        ref = reference.charAt(i),
        basePair = seq.charAt(i);
    if (ref != basePair) {
      out.push({
        pos,
        basePair
      });
    }
  }
  return out;
}

module.exports = {
  pileup,
  addToPileup,
  getDifferingBasePairs
};

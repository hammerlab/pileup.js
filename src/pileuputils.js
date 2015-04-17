/** @flow */
'use strict';

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

module.exports = {pileup};

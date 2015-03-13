/**
 * Grab-bag of utility functions.
 * @flow
 */


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

module.exports = {tupleLessOrEqual, tupleRangeOverlaps};

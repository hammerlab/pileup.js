/* @flow */
'use strict';

var _ = require('underscore');
var Interval = require('./Interval');

class CodingInterval extends Interval {
  isCoding: boolean;
  constructor(start: number, stop: number, isCoding: boolean) {
    super(start, stop);
    this.isCoding = isCoding;
  }
}

/**
 * Split exons which cross the coding/non-coding boundary into purely coding &
 * non-coding parts.
 */
function splitCodingExons(exons: Interval[],
                          codingRegion: Interval): CodingInterval[] {
  return _.flatten(exons.map(exon => {
    // Special case: the coding region is entirely contained by this exon.
    if (exon.containsInterval(codingRegion)) {
      // split into three parts.
      return [
          new CodingInterval(exon.start, codingRegion.start - 1, false),
          new CodingInterval(codingRegion.start, codingRegion.stop, true),
          new CodingInterval(codingRegion.stop + 1, exon.stop, false)
      ].filter(interval => interval.start <= interval.stop);
    }

    var startIsCoding = codingRegion.contains(exon.start),
        stopIsCoding = codingRegion.contains(exon.stop);
    if (startIsCoding == stopIsCoding) {
      return [new CodingInterval(exon.start, exon.stop, startIsCoding)];
    } else if (startIsCoding) {
      return [
        new CodingInterval(exon.start, codingRegion.stop, true),
        new CodingInterval(codingRegion.stop + 1, exon.stop, false)
      ];
    } else {
      return [
        new CodingInterval(exon.start, codingRegion.start - 1, false),
        new CodingInterval(codingRegion.start, exon.stop, true)
      ];
    }
  }));
}

module.exports = {splitCodingExons, CodingInterval};

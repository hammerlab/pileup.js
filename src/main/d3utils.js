/**
 * D3/DOM-related utility functions.
 * @flow
 */
'use strict';

import type {GenomeRange} from './react-types';

var d3 = require('d3');

/**
 * Shared x-axis scaling logic for tracks
 */
function getTrackScale(range: GenomeRange, width: number) {
  if (!range) return d3.scale.linear();
  var offsetPx = range.offsetPx || 0;
  var scale = d3.scale.linear()
          .domain([range.start, range.stop + 1])  // 1 bp wide
          .range([-offsetPx, width - offsetPx]);
  return scale;
}

/**
 * Formats the size of a view and infers what prefix/unit to show.
 * This formatting follows IGV's conventions regarding range display:
 *  "1 bp", "101 bp", "1,001 bp", "1,001 kbp", ...
 */
function formatRange(viewSize: number): any {
  var tmpViewSize = viewSize / 1000,
      fprefix = d3.formatPrefix(Math.max(1, tmpViewSize)),
      unit = fprefix.symbol + "bp",  // bp, kbp, Mbp, Gbp
      prefix = d3.format(',f.0')(fprefix.scale(viewSize));
  return {prefix, unit};
}

module.exports = {
  formatRange,
  getTrackScale
};

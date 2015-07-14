/**
 * D3/DOM-related utility functions.
 * @flow
 */
'use strict';

var d3 = require('d3'),
    types = require('./react-types'),
    ContigInterval = require('./ContigInterval');

/**
 * Shared x-axis scaling logic for tracks
 */
function getTrackScale(range: types.GenomeRange, width: number) {
  if (!range) return d3.scale.linear();
  var offsetPx = range.offsetPx || 0;
  var scale = d3.scale.linear()
          .domain([range.start, range.stop + 1])  // 1 bp wide
          .range([-offsetPx, width - offsetPx]);
  return scale;
}

module.exports = {
  getTrackScale
};

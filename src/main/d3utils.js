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

/**
 * Sizes a canvas appropriately for this device.
 */
function sizeCanvas(el: HTMLCanvasElement, width: number, height: number) {
  var ratio = window.devicePixelRatio;
  el.width = width * ratio;
  el.height = height * ratio;
  el.style.width = width + 'px';
  el.style.height = height + 'px';
  var ctx = el.getContext('2d');
  if (ctx !== null && ctx instanceof CanvasRenderingContext2D) {
    ctx.scale(ratio, ratio);
  }
}

module.exports = {
  formatRange,
  getTrackScale,
  sizeCanvas
};

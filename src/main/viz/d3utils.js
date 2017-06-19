/**
 * D3/DOM-related utility functions.
 * @flow
 */
'use strict';

import scale from '../scale';

// Subtype of GenomeRange
type Range = {
  start: number;
  stop: number;
};

export type Scale = (num: number) => number;

/**
 * Shared x-axis scaling logic for tracks
 */
function getTrackScale(range: Range, width: number): any {
  if (!range) return scale.linear();
  var offsetPx = range.offsetPx || 0;
  return scale.linear()
          .domain([range.start, range.stop + 1])  // 1 bp wide
          .range([-offsetPx, width - offsetPx]);
}

var formatPrefixes = ["","k","M","G","T","P","E","Z","Y"];

// Returns the SI-prefix for num, ala d3.formatPrefix.
// See https://github.com/mbostock/d3/blob/5b981a18/src/format/formatPrefix.js
function formatPrefix(value: number) {
  var i = 0;
  if (value) {
    if (value < 0) value *= -1;
    i = 1 + Math.floor(1e-12 + Math.log(value) / Math.LN10);
    i = Math.max(0, Math.min(24, Math.floor((i - 1) / 3) * 3));
  }
  var k = Math.pow(10, i);
  return {
    symbol: formatPrefixes[i / 3],
    scale: d => d / k
  };
}

/**
 * Formats the size of a view and infers what prefix/unit to show.
 * This formatting follows IGV's conventions regarding range display:
 *  "1 bp", "101 bp", "1,001 bp", "1,001 kbp", ...
 */
function formatRange(viewSize: number): {prefix: string, unit: string} {
  var tmpViewSize = viewSize / 1000,
      fprefix = formatPrefix(Math.max(1, tmpViewSize)),
      unit = fprefix.symbol + "bp",  // bp, kbp, Mbp, Gbp
      prefix = Math.round(fprefix.scale(viewSize)).toLocaleString();
  return {prefix, unit};
}

/**
 * Sizes a canvas appropriately for this device.
 */
function sizeCanvas(el: HTMLCanvasElement, width: number, height: number) {
  /* // Setting canvas geometry styles results in incorrect rendering on retina displays in default mode
  var ratio = window.devicePixelRatio;
  el.width = width * ratio;
  el.height = height * ratio;
  el.style.width = width + 'px';
  el.style.height = height + 'px';
  var ctx = el.getContext('2d');
  if (ctx !== null && ctx instanceof CanvasRenderingContext2D) {
    ctx.scale(ratio, ratio);
  }
  */
  el.width = width;
  el.height = height;
  if (el.height > 32767) {
    el.height = 32767;
  }
}

/**
 * Find the closest parent with a given class name.
 */
function findParent(inEl: Element, className: string): ?Element {
  var el = inEl;  // this is for Flow.
  do {
    if (el.classList.contains(className)) return el;
    el = el.parentElement;
  } while (el);
  return null;
}

module.exports = {
  formatRange,
  getTrackScale,
  sizeCanvas,
  findParent
};

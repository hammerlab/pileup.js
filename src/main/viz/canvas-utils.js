/**
 * Utility code for working with the HTML canvas element.
 *
 * @flow
 */
'use strict';

// Return the 2D context for a canvas. This is helpful for type safety.
function getContext(el: Element): CanvasRenderingContext2D {
  // The typecasts through `any` are to fool flow.
  var canvas = ((el : any) : HTMLCanvasElement);
  var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
  return ctx;
}

// Stroke a line between two points
function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

module.exports = {
  getContext,
  drawLine
};

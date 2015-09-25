/**
 * Utility code for working with the HTML canvas element.
 *
 * @flow
 */

// Return the 2D context for a canvas. This is helpful for type safety.
function getContext(el: Element): CanvasRenderingContext2D {
  // The typecasts through `any` are to fool flow.
  var canvas = ((el : any) : HTMLCanvasElement);
  var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
  return ctx;
}

module.exports = {
  getContext
}

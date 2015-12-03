/**
 * A canvas which maintains a cache of previously-rendered tiles.
 * @flow
 */
'use strict';

import type {DataCanvasRenderingContext2D} from 'data-canvas';

import _ from 'underscore';

import scale from '../scale';
import ContigInterval from '../ContigInterval';
import Interval from '../Interval';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import utils from '../utils';
import d3utils from './d3utils';

type Tile = {
  pixelsPerBase: number;
  range: ContigInterval<string>;
  buffer: HTMLCanvasElement;
};

const EPSILON = 1e-6;
const MIN_PX_PER_BUFFER = 500;

const DEBUG_RENDER_TILE_EDGES = false;

class TiledCanvas {
  tileCache: Tile[];

  constructor() {
    this.tileCache = [];
  }

  renderTile(tile: Tile) {
    var range = tile.range,
        height = this.heightForRef(range.contig),
        width = Math.round(tile.pixelsPerBase * range.length());
    // TODO: does it make sense to re-use canvases?
    tile.buffer = document.createElement('canvas');
    d3utils.sizeCanvas(tile.buffer, width, height);

    // The far right edge of the tile is the start of the _next_ range's base
    // pair, not the start of the last one in this tile.
    var sc = scale.linear().domain([range.start(), range.stop() + 1]).range([0, width]);
    var ctx = canvasUtils.getContext(tile.buffer);
    var dtx = dataCanvas.getDataContext(ctx);
    this.render(dtx, sc, range);
  }

  // Create (and render) new tiles to fill the gaps.
  makeNewTiles(existingTiles: Interval[],
               pixelsPerBase: number,
               range: ContigInterval<string>): Tile[] {
    var newIntervals = TiledCanvas.getNewTileRanges(
          existingTiles, range.interval, pixelsPerBase);

    var newTiles = newIntervals.map(iv => ({
      pixelsPerBase,
      range: new ContigInterval(range.contig, iv.start, iv.stop),
      buffer: document.createElement('canvas')
    }));

    // TODO: it would be better to wrap these calls in requestAnimationFrame,
    // so that rendering is done off the main event loop.
    newTiles.forEach(tile => this.renderTile(tile));
    this.tileCache = this.tileCache.concat(newTiles);
    this.tileCache.sort((a, b) => ContigInterval.compare(a.range, b.range));
    return newTiles;
  }

  renderToScreen(ctx: CanvasRenderingContext2D,
                 range: ContigInterval<string>,
                 scale: (num: number) => number) {
    var pixelsPerBase = scale(1) - scale(0);
    var tilesAtRes = this.tileCache.filter(tile => Math.abs(tile.pixelsPerBase - pixelsPerBase) < EPSILON && range.chrOnContig(tile.range.contig));
    var height = this.heightForRef(range.contig);

    var existingIntervals = tilesAtRes.map(tile => tile.range.interval);
    if (!range.interval.isCoveredBy(existingIntervals)) {
      tilesAtRes = tilesAtRes.concat(this.makeNewTiles(existingIntervals, pixelsPerBase, range));
    }

    var tiles = tilesAtRes.filter(tile => range.chrIntersects(tile.range));

    tiles.forEach(tile => {
      var left = Math.round(scale(tile.range.start())),
          nextLeft = Math.round(scale(tile.range.stop() + 1)),
          width = nextLeft - left;
      // Drawing a 0px tall canvas throws in Firefox and PhantomJS.
      if (tile.buffer.height === 0) return;
      // We can't just throw the images on the screen without scaling due to
      // rounding issues, which can result in 1px gaps or overdrawing.
      // We always have:
      //   width - tile.buffer.width \in {-1, 0, +1}
      ctx.drawImage(tile.buffer, 
                    0, 0, tile.buffer.width, tile.buffer.height,
                    left, 0, width, tile.buffer.height);

      if (DEBUG_RENDER_TILE_EDGES) {
        ctx.save();
        ctx.strokeStyle = 'black';
        canvasUtils.drawLine(ctx, left - 0.5, 0, left - 0.5, height);
        canvasUtils.drawLine(ctx, nextLeft - 0.5, 0, nextLeft - 0.5, height);
        ctx.restore();
      }
    });
  }

  invalidateAll() {
    this.tileCache = [];
  }

  invalidateRange(range: ContigInterval) {
    this.tileCache = this.tileCache.filter(tile => !tile.range.chrIntersects(range));
  }

  heightForRef(ref: string): number {
    throw 'Not implemented';
  }

  render(dtx: DataCanvasRenderingContext2D,
         scale: (x: number)=>number,
         range: ContigInterval<string>): void {
    throw 'Not implemented';
  }

  // requires that existingIntervals be sorted.
  static getNewTileRanges(existingIntervals: Interval[],
                          range: Interval,
                          pixelsPerBase: number): Interval[] {
    var ivWidth = Math.ceil(MIN_PX_PER_BUFFER / pixelsPerBase);
    var firstStart = Math.floor(range.start / ivWidth) * ivWidth;
    var ivs = _.range(firstStart, range.stop, ivWidth)
               .map(start => new Interval(start, start + ivWidth - 1))
               .filter(iv => !iv.isCoveredBy(existingIntervals));

    return utils.flatMap(ivs, iv => iv.complementIntervals(existingIntervals))
                .filter(iv => iv.intersects(range));
  }

}

module.exports = TiledCanvas;

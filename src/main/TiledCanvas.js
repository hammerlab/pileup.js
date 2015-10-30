/**
 * A canvas which maintains a cache of previously-rendered tiles.
 * @flow
 */

import type {DataCanvasRenderingContext2D} from 'data-canvas';

var _ = require('underscore');

var scale = require('./scale'),
    ContigInterval = require('./ContigInterval'),
    Interval = require('./Interval'),
    canvasUtils = require('./canvas-utils'),
    dataCanvas = require('data-canvas'),
    {CigarOp} = require('./pileuputils'),
    utils = require('./utils');

type Tile = {
  pixelsPerBase: number;
  range: ContigInterval<string>;
  buffer: HTMLCanvasElement;
};

const EPSILON = 1e-6;
const MIN_PX_PER_BUFFER = 500;

class TileCache {
  tileCache: Tile[];

  constructor() {
    this.tileCache = [];
  }

  renderTile(tile: Tile) {
    var range = tile.range;
    var height = this.heightForRef(range.contig),
        width = Math.round(tile.pixelsPerBase * range.length());
    tile.buffer = document.createElement('canvas');
    tile.buffer.width = width;
    tile.buffer.height = height;

    var sc = scale.linear().domain([range.start(), range.stop()]).range([0, width]);
    var ctx = canvasUtils.getContext(tile.buffer);
    var dtx = dataCanvas.getDataContext(ctx);
    this.render(dtx, sc, range);
  }

  // Create (and render) new tiles to fill the gaps.
  makeNewTiles(existingTiles: Interval[],
               pixelsPerBase: number,
               range: ContigInterval<string>): Tile[] {
    var newIntervals = TileCache.getNewTileRanges(existingTiles, range.interval, pixelsPerBase);

    var newTiles = newIntervals.map(iv => ({
      pixelsPerBase,
      range: new ContigInterval(range.contig, iv.start, iv.stop),
      buffer: document.createElement('canvas')
    }));

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

    var existingIntervals = tilesAtRes.map(tile => tile.range.interval);
    if (!range.interval.isCoveredBy(existingIntervals)) {
      tilesAtRes = tilesAtRes.concat(this.makeNewTiles(existingIntervals, pixelsPerBase, range));
    }

    var tiles = tilesAtRes.filter(tile => range.chrIntersects(tile.range));

    tiles.forEach(tile => {
      var left = Math.round(scale(tile.range.start())),
          nextLeft = Math.round(scale(tile.range.stop() + 1)),
          width = nextLeft - left;
      // We can't just throw the images on the screen without scaling due to
      // rounding issues, which can result in 1px gaps or overdrawing.
      // We always have:
      //   width - tile.buffer.width \in {-1, 0, +1}
      ctx.drawImage(tile.buffer, left, 0, width, tile.buffer.height);
    });
  }

  invalidateAll() {
    this.tileCache = [];
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

module.exports = TileCache;

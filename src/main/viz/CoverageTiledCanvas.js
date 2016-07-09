
import type {DataCanvasRenderingContext2D} from 'data-canvas';
import ContigInterval from '../ContigInterval';
import TiledCanvas from './TiledCanvas';

class CoverageTiledCanvas extends TiledCanvas {
  height: number;
  options: Object;
  cache: DepthCache;

  constructor(cache: DepthCache, height: number, options: Object) {
    super();

    this.cache = cache;
    this.height = Math.max(1, height);
    this.options = options;
  }

  heightForRef(ref: string): number {
    return this.height;
  }

  update(height: number, options: Object) {
    // workaround for an issue in PhantomJS where height always comes out to zero.
    this.height = Math.max(1, height);
    this.options = options;
  }

  yScaleForRef(ref: string): (y: number) => number {
    var maxCoverage = this.cache.maxCoverageForRef(ref);

    var padding = 10;  // TODO: move into style
    return scale.linear()
      .domain([maxCoverage, 0])
      .range([padding, this.height - padding])
      .nice();
  }

  render(ctx: DataCanvasRenderingContext2D,
         xScale: (x: number)=>number,
         range: ContigInterval<string>) {
    var bins = this.cache.binsForRef(range.contig);
    var yScale = this.yScaleForRef(range.contig);
    var relaxedRange = new ContigInterval(
      range.contig, range.start() - 1, range.stop() + 1);
    renderBars(ctx, xScale, yScale, relaxedRange, bins, this.options);
  }
}

module.exports = CoverageTiledCanvas;


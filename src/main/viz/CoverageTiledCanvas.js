
import type {DataCanvasRenderingContext2D} from 'data-canvas';
import ContigInterval from '../ContigInterval';
import TiledCanvas from './TiledCanvas';
import scale from '../scale';
import type {BinSummary} from './CoverageCache';

import _ from 'underscore';
import style from '../style';

// Basic setup (TODO: make this configurable by the user)
const SHOW_MISMATCHES = true;

// Only show mismatch information when there are more than this many
// reads supporting that mismatch.
const MISMATCH_THRESHOLD = 1;

// Draw coverage bins & mismatches
function renderBars(ctx: DataCanvasRenderingContext2D,
                    xScale: (num: number) => number,
                    yScale: (num: number) => number,
                    range: ContigInterval<string>,
                    bins: {[key: number]: BinSummary},
                    options: Object) {
  if (_.isEmpty(bins)) return;

  var barWidth = xScale(1) - xScale(0);
  var showPadding = (barWidth > style.COVERAGE_MIN_BAR_WIDTH_FOR_GAP);
  var padding = showPadding ? 1 : 0;

  var binPos = function(pos: number, count: number) {
    // Round to integer coordinates for crisp lines, without aliasing.
    var barX1 = Math.round(xScale(1 + pos)),
      barX2 = Math.round(xScale(2 + pos)) - padding,
      barY = Math.round(yScale(count));
    return {barX1, barX2, barY};
  };

  var mismatchBins = ({} : {[key:number]: BinSummary});  // keep track of which ones have mismatches
  var vBasePosY = yScale(0);  // the very bottom of the canvas
  var start = range.start(),
    stop = range.stop();
  let {barX1} = binPos(start, (start in bins) ? bins[start].count : 0);
  ctx.fillStyle = style.COVERAGE_BIN_COLOR;
  ctx.beginPath();
  ctx.moveTo(barX1, vBasePosY);
  for (var pos = start; pos < stop; pos++) {
    var bin = bins[pos];
    if (!bin) continue;
    ctx.pushObject(bin);
    let {barX1, barX2, barY} = binPos(pos, bin.count);
    ctx.lineTo(barX1, barY);
    ctx.lineTo(barX2, barY);
    if (showPadding) {
      ctx.lineTo(barX2, vBasePosY);
      ctx.lineTo(barX2 + 1, vBasePosY);
    }

    if (SHOW_MISMATCHES && !_.isEmpty(bin.mismatches)) {
      mismatchBins[pos] = bin;
    }

    ctx.popObject();
  }
  let {barX2} = binPos(stop, (stop in bins) ? bins[stop].count : 0);
  ctx.lineTo(barX2, vBasePosY);  // right edge of the right bar.
  ctx.closePath();
  ctx.fill();

  // Now render the mismatches
  _.each(mismatchBins, (bin, pos) => {
    if (!bin.mismatches) return;  // this is here for Flow; it can't really happen.
    const mismatches = _.clone(bin.mismatches);
    pos = Number(pos);  // object keys are strings, not numbers.

    // If this is a high-frequency variant, add in the reference.
    var mismatchCount = _.reduce(mismatches, (x, y) => x + y);
    var mostFrequentMismatch = _.max(mismatches);
    if (mostFrequentMismatch > MISMATCH_THRESHOLD &&
      mismatchCount > options.vafColorThreshold * bin.count &&
      mismatchCount < bin.count) {
      if (bin.ref) {  // here for flow; can't realy happen
        mismatches[bin.ref] = bin.count - mismatchCount;
      }
    }

    let {barX1, barX2} = binPos(pos, bin.count);
    ctx.pushObject(bin);
    var countSoFar = 0;
    _.chain(mismatches)
      .map((count, base) => ({count, base}))  // pull base into the object
      .filter(({count}) => count > MISMATCH_THRESHOLD)
      .sortBy(({count}) => -count)  // the most common mismatch at the bottom
      .each(({count, base}) => {
        var misMatchObj = {position: 1 + pos, count, base};
        ctx.pushObject(misMatchObj);  // for debugging and click-tracking

        ctx.fillStyle = style.BASE_COLORS[base];
        var y = yScale(countSoFar);
        ctx.fillRect(barX1,
          y,
          Math.max(1, barX2 - barX1),  // min width of 1px
          yScale(countSoFar + count) - y);
        countSoFar += count;

        ctx.popObject();
      });
    ctx.popObject();
  });
}

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


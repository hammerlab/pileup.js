/**
 * Coverage visualization of Alignment sources.
 * @flow
 */
'use strict';

import type {Alignment, AlignmentDataSource} from '../Alignment';
import type Interval from '../Interval';
import type {TwoBitSource} from '../sources/TwoBitDataSource';
import type {DataCanvasRenderingContext2D} from 'data-canvas';
import type {BinSummary} from './CoverageCache';
import type {Scale} from './d3utils';

import React from 'react';
import scale from '../scale';
import shallowEquals from 'shallow-equals';
import d3utils from './d3utils';
import _ from 'underscore';
import dataCanvas from 'data-canvas';
import canvasUtils from './canvas-utils';
import CoverageCache from './CoverageCache';
import TiledCanvas from './TiledCanvas';
import style from '../style';
import ContigInterval from '../ContigInterval';

// Basic setup (TODO: make this configurable by the user)
const SHOW_MISMATCHES = true;

// Only show mismatch information when there are more than this many
// reads supporting that mismatch.
const MISMATCH_THRESHOLD = 1;


class CoverageTiledCanvas extends TiledCanvas {
  height: number;
  options: Object;
  cache: CoverageCache;

  constructor(cache: CoverageCache, height: number, options: Object) {
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

  yScaleForRef(ref: string, bottomPadding: number, topPadding:number): (y: number) => number {
    var maxCoverage = this.cache.maxCoverageForRef(ref);
    return scale.linear()
      .domain([maxCoverage, 0])
      .range([bottomPadding, this.height - topPadding])
      .nice();
  }

  render(ctx: DataCanvasRenderingContext2D,
         xScale: (x: number)=>number,
         range: ContigInterval<string>) {
    var bins = this.cache.binsForRef(range.contig);
    var yScale = this.yScaleForRef(range.contig, 0, 30);
    var relaxedRange = new ContigInterval(
        range.contig, range.start() - 1, range.stop() + 1);
    renderBars(ctx, xScale, yScale, relaxedRange, bins, this.options);
  }
}


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

type Props = {
  width: number;
  height: number;
  range: GenomeRange;
  source: AlignmentDataSource;
  referenceSource: TwoBitSource;
  options: {
    vafColorThreshold: number
  }
};

class CoverageTrack extends React.Component {
  props: Props;
  state: void;
  cache: CoverageCache;
  tiles: CoverageTiledCanvas;
  static defaultOptions: Object;

  constructor(props: Props) {
    super(props);
  }

  render(): any {
    return <canvas ref='canvas' onClick={this.handleClick.bind(this)} />;
  }

  getScale(): Scale {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidMount() {
    this.cache = new CoverageCache(this.props.referenceSource);
    this.tiles = new CoverageTiledCanvas(this.cache, this.props.height, this.props.options);

    this.props.source.on('newdata', range => {
      var oldMax = this.cache.maxCoverageForRef(range.contig);
      this.props.source.getAlignmentsInRange(range)
                       .forEach(read => this.cache.addAlignment(read));
      var newMax = this.cache.maxCoverageForRef(range.contig);

      if (oldMax != newMax) {
        this.tiles.invalidateAll();
      } else {
        this.tiles.invalidateRange(range);
      }
      this.visualizeCoverage();
    });

    this.props.referenceSource.on('newdata', range => {
      this.cache.updateMismatches(range);
      this.tiles.invalidateRange(range);
      this.visualizeCoverage();
    });
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
        !shallowEquals(this.state, prevState)) {
      if (this.props.height != prevProps.height ||
          this.props.options != prevProps.options) {
        this.tiles.update(this.props.height, this.props.options);
        this.tiles.invalidateAll();
      }
      this.visualizeCoverage();
    }
  }

  getContext(): CanvasRenderingContext2D {
    var canvas = (this.refs.canvas : HTMLCanvasElement);
    // The typecast through `any` is because getContext could return a WebGL context.
    var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
    return ctx;
  }

  // Draw three ticks on the left to set the scale for the user
  renderTicks(ctx: DataCanvasRenderingContext2D, yScale: (num: number)=>number) {
    var axisMax = yScale.domain()[0];
    [0, Math.round(axisMax / 2), axisMax].forEach(tick => {
      // Draw a line indicating the tick
      ctx.pushObject({value: tick, type: 'tick'});
      var tickPosY = Math.round(yScale(tick));
      ctx.strokeStyle = style.COVERAGE_FONT_COLOR;
      canvasUtils.drawLine(ctx, 0, tickPosY, style.COVERAGE_TICK_LENGTH, tickPosY);
      ctx.popObject();

      var tickLabel = tick + 'X';
      ctx.pushObject({value: tick, label: tickLabel, type: 'label'});
      // Now print the coverage information
      ctx.font = style.COVERAGE_FONT_STYLE;
      var textPosX = style.COVERAGE_TICK_LENGTH + style.COVERAGE_TEXT_PADDING,
          textPosY = tickPosY + style.COVERAGE_TEXT_Y_OFFSET;
      // The stroke creates a border around the text to make it legible over the bars.
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeText(tickLabel, textPosX, textPosY);
      ctx.lineWidth = 1;
      ctx.fillStyle = style.COVERAGE_FONT_COLOR;
      ctx.fillText(tickLabel, textPosX, textPosY);
      ctx.popObject();
    });
  }

  visualizeCoverage() {
    var canvas = (this.refs.canvas : HTMLCanvasElement),
        width = this.props.width,
        height = this.props.height,
        range = ContigInterval.fromGenomeRange(this.props.range);

    // Hold off until height & width are known.
    if (width === 0) return;
    d3utils.sizeCanvas(canvas, width, height);

    var ctx = dataCanvas.getDataContext(this.getContext());
    ctx.save();
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var yScale = this.tiles.yScaleForRef(range.contig, 10, 10);

    this.tiles.renderToScreen(ctx, range, this.getScale());
    this.renderTicks(ctx, yScale);

    ctx.restore();
  }

  handleClick(reactEvent: any) {
    var ev = reactEvent.nativeEvent,
        x = ev.offsetX;

    // It's simple to figure out which position was clicked using the x-scale.
    // No need to render the scene to determine what was clicked.
    var range = ContigInterval.fromGenomeRange(this.props.range),
        xScale = this.getScale(),
        bins = this.cache.binsForRef(range.contig),
        pos = Math.floor(xScale.invert(x)) - 1,
        bin = bins[pos];

    var alert = window.alert || console.log;
    if (bin) {
      var mmCount = bin.mismatches ? _.reduce(bin.mismatches, (a, b) => a + b) : 0;
      var ref = bin.ref || this.props.referenceSource.getRangeAsString(
          {contig: range.contig, start: pos, stop: pos});

      // Construct a JSON object to show the user.
      var messageObject = _.extend(
        {
          'position': range.contig + ':' + (1 + pos),
          'read depth': bin.count
        },
        bin.mismatches);
      messageObject[ref] = bin.count - mmCount;
      alert(JSON.stringify(messageObject, null, '  '));
    }
  }
}

CoverageTrack.displayName = 'coverage';
CoverageTrack.defaultOptions = {
  // Color the reference base in the bar chart when the Variant Allele Fraction
  // exceeds this amount. When there are >=2 agreeing mismatches, they are
  // always rendered. But for mismatches below this threshold, the reference is
  // not colored in the bar chart. This draws attention to high-VAF mismatches.
  vafColorThreshold: 0.2
};


module.exports = CoverageTrack;

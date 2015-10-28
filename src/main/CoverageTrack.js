/**
 * Coverage visualization of Alignment sources.
 * @flow
 */
'use strict';

import type * as SamRead from './SamRead';
import type * as Interval from './Interval';
import type {TwoBitSource} from './TwoBitDataSource';

var React = require('react'),
    scale = require('./scale'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    d3utils = require('./d3utils'),
    _ = require("underscore"),
    dataCanvas = require('data-canvas'),
    canvasUtils = require('./canvas-utils'),
    {getOpInfo} = require('./pileuputils'),
    style = require('./style'),
    ContigInterval = require('./ContigInterval');

type BinSummary = {
  count: number;
  mismatches: {[key: string]: number};
}

type BinSummaryWithLocation = {
  position: string;
  count:number;
  mismatches: {[key: string]: number};
}

// Basic setup (TODO: make this configurable by the user)
var SHOW_MISMATCHES = true;
// Only show mismatch information when there are more than this many
// reads supporting that mismatch.
var MISMATCH_THRESHOLD = 1;

/**
 * Extract summary statistics from the read data.
 */
function extractSummaryStatistics(reads: Array<SamRead>,
                                  contig: string,
                                  referenceSource: TwoBitSource) {
  var binCounts = ({}: {[key: number]: BinSummary});

  // This is written in an imperative style (instead of with _.groupBy)
  // as an optimization.
  _.each(reads, read => {
    var interval = read.getInterval();

    var opInfo = getOpInfo(read, referenceSource);

    var start = interval.start(),
        stop = interval.stop();
    for (var j = start; j <= stop; j++) {
      if (!binCounts[j]) binCounts[j] = {count: 0, mismatches: {}};
      binCounts[j].count += 1;
    }

    // Capture mismatches for future use
    _.each(opInfo.mismatches, m => {
      var binCount = binCounts[m.pos + 1];
      if (binCount) {
        var mismatches = binCount.mismatches;
        mismatches[m.basePair] = 1 + (mismatches[m.basePair] || 0);
      } else {
        // do nothing, we don't info on this position yet
      }
    });
  });
  var maxCoverage = _.max(binCounts, bc => bc.count).count;

  var posCounts = _.map(binCounts,
                        (bc, position) => ({position: Number(position),
                                            count: bc.count,
                                            mismatches: bc.mismatches}));
  var sortedPosCounts = _.sortBy(posCounts, bin => bin.position);

  sortedPosCounts.forEach(({position, count, mismatches}) => {
    if (_.isEmpty(mismatches)) return;
    var ref = referenceSource.getRangeAsString({contig, start: position - 1, stop: position - 1});
    // var cs = _.map(mismatches, mc => mc.count);
    var mismatchCount = _.reduce(mismatches, (x,y) => x+y);
    if (mismatchCount > 0.2 * count) {
      mismatches[ref] = count - mismatchCount;
    }
  });

  return {binCounts: sortedPosCounts, maxCoverage};
}

class CoverageTrack extends React.Component {
  constructor(props: Object) {
    super(props);
    this.state = {
      width: 0,
      height: 0,
      labelSize: {weight: 0, height: 0},  // for precise padding calculations
      reads: [],
      binCounts: [],
      maxCoverage: 0
    };
  }

  render(): any {
    return <canvas ref='canvas' />;
  }

  getScale() {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidMount() {
    var updateState = () => {
      var ci = new ContigInterval(this.props.range.contig, 0, Number.MAX_VALUE),
          reads = this.props.source.getAlignmentsInRange(ci),
          {binCounts, maxCoverage} = extractSummaryStatistics(reads, this.props.range.contig, this.props.referenceSource);

      this.setState({
        reads,
        binCounts,
        maxCoverage
      });
    };

    this.props.source.on('newdata', updateState);
    this.props.referenceSource.on('newdata', updateState);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
        !shallowEquals(this.state, prevState)) {
      this.visualizeCoverage();
    }
  }

  binsInRange(): BinSummaryWithLocation[] {
    var {start, stop} = this.props.range;
    return this.state.binCounts.filter(
        ({position}) => (position >= start - 1 && position <= stop + 1));
  }

  getContext(): CanvasRenderingContext2D {
    var canvas = (this.refs.canvas : HTMLCanvasElement);
    // The typecast through `any` is because getContext could return a WebGL context.
    var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
    return ctx;
  }

  // Draw coverage bins & mismatches
  renderBars(ctx, yScale) {
    var bins = this.binsInRange();
    if (bins.length === 0) return;

    var xScale = this.getScale();
    var barWidth = xScale(1) - xScale(0);
    var showPadding = (barWidth > style.COVERAGE_MIN_BAR_WIDTH_FOR_GAP);
    var padding = showPadding ? 1 : 0;

    var binPos = function(bin) {
      // Round to integer coordinates for crisp lines, without aliasing.
      var barX1 = Math.round(xScale(bin.position)),
          barX2 = Math.round(xScale(bin.position + 1)) - padding,
          barY = Math.round(yScale(bin.count));
      return {barX1, barX2, barY};
    };

    var mismatchBins = [];  // keep track of which ones have mismatches
    var vBasePosY = yScale(0);  // the very bottom of the canvas
    ctx.fillStyle = style.COVERAGE_BIN_COLOR;
    ctx.beginPath();
    var {barX1} = binPos(bins[0]);
    ctx.moveTo(barX1, vBasePosY);
    bins.forEach(bin => {
      ctx.pushObject(bin);
      var {barX1, barX2, barY} = binPos(bin);
      ctx.lineTo(barX1, barY);
      ctx.lineTo(barX2, barY);
      if (showPadding) {
        ctx.lineTo(barX2, vBasePosY);
        ctx.lineTo(barX2 + 1, vBasePosY);
      }

      if (SHOW_MISMATCHES && !_.isEmpty(bin.mismatches)) {
        mismatchBins.push(bin);
      }

      ctx.popObject();
    });
    var {barX2} = binPos(bins[bins.length - 1]);
    ctx.lineTo(barX2, vBasePosY);  // right edge of the right bar.
    ctx.closePath();
    ctx.fill();

    mismatchBins.forEach(bin => {
      var {barX1, barX2} = binPos(bin);
      ctx.pushObject(bin);
      var countSoFar = 0;
      _.chain(bin.mismatches)
        .map((count, base) => ({count, base}))  // pull base into the object
        .filter(({count}) => count > MISMATCH_THRESHOLD)
        .sortBy(({count}) => -count)  // the most common mismatch at the bottom
        .each(({count, base}) => {
          var misMatchObj = {position: bin.position, count, base};
          ctx.pushObject(misMatchObj);  // for debugging and click-tracking

          ctx.fillStyle = style.BASE_COLORS[base];
          var y = yScale(countSoFar);
          ctx.fillRect(barX1,
                       y,
                       barX2 - barX1,
                       yScale(countSoFar + count) - y);
          countSoFar += count;

          ctx.popObject();
        });
      ctx.popObject();
    });

  }

  // Draw three ticks on the left to set the scale for the user
  renderTicks(ctx, yScale) {
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
        padding = 10;

    // Hold off until height & width are known.
    if (width === 0) return;
    d3utils.sizeCanvas(canvas, width, height);

    var yScale = scale.linear()
      .domain([this.state.maxCoverage, 0])
      .range([padding, height - padding])
      .nice();

    var ctx = dataCanvas.getDataContext(this.getContext());
    ctx.save();
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.renderBars(ctx, yScale);
    this.renderTicks(ctx, yScale);

    ctx.restore();
  }
}

CoverageTrack.propTypes = {
  range: types.GenomeRange.isRequired,
  source: React.PropTypes.object.isRequired,
  referenceSource: React.PropTypes.object.isRequired,
};
CoverageTrack.displayName = 'coverage';


module.exports = CoverageTrack;

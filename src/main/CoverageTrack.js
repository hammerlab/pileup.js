/**
 * Coverage visualization of Alignment sources.
 * @flow
 */
'use strict';

import type * as SamRead from './SamRead';
import type * as Interval from './Interval';
import type {TwoBitSource} from './TwoBitDataSource';

var React = require('./react-shim'),
    d3 = require('d3/minid3'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    d3utils = require('./d3utils'),
    _ = require("underscore"),
    dataCanvas = require('data-canvas'),
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
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement);
    // The typecast through `any` is because getContext could return a WebGL context.
    var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
    return ctx;
  }

  visualizeCoverage() {
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement),
        width = this.props.width,
        height = this.props.height,
        padding = 10,
        xScale = this.getScale();

    // Hold off until height & width are known.
    if (width === 0) return;
    d3utils.sizeCanvas(canvas, width, height);

    var yScale = d3.scale.linear()
      .domain([this.state.maxCoverage, 0])
      .range([padding, height - padding])
      .nice();
    // The nice() call on the axis will give us a new domain to work with
    // Let's get our domain max back from the nicified scale
    var axisMax = yScale.domain()[0];

    var ctx = dataCanvas.getDataContext(this.getContext());
    ctx.save();
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var barWidth = xScale(1) - xScale(0),
        barPadding = barWidth * style.COVERAGE_BIN_PADDING_CONSTANT;

    // Draw coverage bins
    this.binsInRange().forEach(bin => {
      ctx.pushObject(bin);
      var barPosX = xScale(bin.position),
          barPosY = yScale(bin.count) - yScale(axisMax),
          barHeight = Math.max(0, yScale(axisMax - bin.count));
      // These are generic coverage bins
      ctx.fillStyle = style.COVERAGE_BIN_COLOR;
      ctx.fillRect(barPosX + barPadding,
                   barPosY,
                   barWidth - barPadding,
                   barHeight);

      // These are variant bars
      if (SHOW_MISMATCHES && !_.isEmpty(bin.mismatches)) {
        var vBasePosY = yScale(0);  // the very bottom of the canvas
        _.chain(bin.mismatches)
          .map((count, base) => ({count, base}))  // pull base into the object
          .sortBy(mc => -mc.count)  // the most common mismatch at the bottom
          .each(mc => {
            var {count, base} = mc;
            if (count <= MISMATCH_THRESHOLD) {
              // Don't show this as it doesn't have enough evidence
              return;
            }

            var misMatchObj = {position: bin.position, count, base};
            ctx.pushObject(misMatchObj);  // for debugging and click-tracking

            // Scale the height based on the percent of reads w/ this mismatch
            var vBarHeight = barHeight * (count / bin.count);
            vBasePosY -= vBarHeight;

            ctx.fillStyle = style.BASE_COLORS[base];
            ctx.fillRect(barPosX + barPadding,
                         vBasePosY,
                         barWidth - barPadding,
                         vBarHeight);

            ctx.popObject();
          });
      }

      ctx.popObject();
    });

    // Draw three ticks
    [0, Math.round(axisMax / 2), axisMax].forEach(tick => {
      // Draw a line indicating the tick
      ctx.pushObject({value: tick, type: 'tick'});
      ctx.beginPath();
      var tickPosY = yScale(tick);
      ctx.moveTo(0, tickPosY);
      ctx.lineTo(style.COVERAGE_TICK_LENGTH, tickPosY);
      ctx.stroke();
      ctx.popObject();

      var tickLabel = tick + 'X';
      ctx.pushObject({value: tick, label: tickLabel, type: 'label'});
      // Now print the coverage information
      ctx.lineWidth = 1;
      ctx.fillStyle = style.COVERAGE_FONT_COLOR;
      ctx.font = style.COVERAGE_FONT_STYLE;
      var textPosY = tickPosY + style.COVERAGE_TEXT_Y_OFFSET;
      ctx.fillText(tickLabel,
                   style.COVERAGE_TICK_LENGTH + style.COVERAGE_TEXT_PADDING,
                   textPosY);
      ctx.popObject();
      // Clean up with this tick
    });

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

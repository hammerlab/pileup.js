/**
 * Coverage visualization of Alignment sources.
 * @flow
 */
'use strict';

import type * as SamRead from './SamRead';
import type * as Interval from './Interval';

var React = require('./react-shim'),
    d3 = require('d3'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    d3utils = require('./d3utils'),
    _ = require("underscore"),
    dataCanvas = require('./data-canvas'),
    style = require('./style'),
    ContigInterval = require('./ContigInterval');


/**
 * Extract summary statistics from the read data.
 */
function extractSummaryStatistics(reads: Array<SamRead>, contig: string) {
  var binCounts = ({}: {[key: number]: number});

  // This is written in an imperative style (instead of with _.groupBy)
  // as an optimization.
  _.each(reads, read => {
    var interval = read.getInterval();

    var start = interval.start(),
        stop = interval.stop();
    for (var j = start; j <= stop; j++) {
      binCounts[j] = (binCounts[j] || 0) + 1;
    }
  });
  var maxCoverage = _.max(binCounts);

  var posCounts = _.map(binCounts, (count, position) => ({position: Number(position), count}));
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
    this.props.source.on('newdata', () => {
      var ci = new ContigInterval(this.props.range.contig, 0, Number.MAX_VALUE),
          reads = this.props.source.getAlignmentsInRange(ci),
          {binCounts, maxCoverage} = extractSummaryStatistics(reads, this.props.range.contig);

      this.setState({
        reads,
        binCounts,
        maxCoverage
      });
    });
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
        !shallowEquals(this.state, prevState)) {
      this.visualizeCoverage();
    }
  }

  binsInRange(): Array<{position:string,count:number}> {
    var {start, stop} = this.props.range;
    return this.state.binCounts.filter(
        ({position}) => (position >= start && position <= stop));
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
    d3utils.setAttributes(canvas, {width, height});

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

    ctx.fillStyle = style.COVERAGE_BIN_COLOR;
    var barWidth = xScale(1) - xScale(0),
        barPadding = barWidth * style.COVERAGE_BIN_PADDING_CONSTANT;

    // Draw coverage bins
    this.binsInRange().forEach(bin => {
      ctx.pushObject(bin);
      var barPosX = xScale(bin.position),
          barPosY = yScale(bin.count) - yScale(axisMax),
          barHeight = Math.max(0, yScale(axisMax - bin.count));
      ctx.fillRect(barPosX + barPadding,
                   barPosY,
                   barWidth - barPadding,
                   barHeight);
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
  onRangeChange: React.PropTypes.func.isRequired
};
CoverageTrack.displayName = 'coverage';


module.exports = CoverageTrack;

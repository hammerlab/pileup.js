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
    utils = require('./utils'),
    d3utils = require('./d3utils'),
    _ = require("underscore"),
    ContigInterval = require('./ContigInterval');

var CoverageTrack = React.createClass({
  displayName: 'coverage',
  propTypes: {
    range: types.GenomeRange,
    onRangeChange: React.PropTypes.func.isRequired,
    source: React.PropTypes.object.isRequired,
    referenceSource: React.PropTypes.object.isRequired
  },
  render: function(): any {
    var range = this.props.range;
    if (!range) {
      return <EmptyTrack />;
    }

    return <NonEmptyCoverageTrack {...this.props} />;
  }
});


class NonEmptyCoverageTrack extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      width: 0,
      height: 0,
      labelSize: {weight: 0, height: 0},  // for precise padding calculations
      reads: []
    };
  }

  render(): any {
    // Fill the container up
    // as we are going to use almost all the space available
    var containerStyles = {
      'height': '100%'
    };

    return (
      <div>
        <div ref='container' style={containerStyles}></div>
      </div>
    );
  }

  getScale() {
    return d3utils.getTrackScale(this.props.range, this.state.width);
  }

  updateSize() {
    var parentDiv = this.refs.container.getDOMNode();
    this.setState({
      width: parentDiv.parentNode.offsetWidth,
      height: parentDiv.offsetHeight
    });
  }

  /**
   * Create a dummy label to see how much space the label occupies.
   * Once calculated, save it into the state for later use in
   * padding-related calculations.
   */
  calculateLabelSize(svg) {
    // Create a dummy element that matches with the style:
    //        ".coverage .y-axis g.tick text {...}"
    var dummyAxis = svg.append('g').attr('class', 'y-axis');
    var dummySize = dummyAxis.append('g').attr('class', 'tick')
      .append('text')
      .text("100X")
      .node()
      .getBBox();  // Measure its size

    // Save the size information
    this.setState({
          labelSize: {height: dummySize.height, width: dummySize.width}
    });
    dummyAxis.remove();
  }

  componentDidMount() {
    window.addEventListener('resize', () => this.updateSize());
    this.updateSize();

    var div = this.refs.container.getDOMNode();
    var svg = d3.select(div).append('svg');
    this.calculateLabelSize(svg);

    // Below, we create the container group for our bars upfront as we want
    // to overlay the axis on top of them; therefore, we have to make sure
    // their container is defined first in the SVG
    svg.append('g').attr('class', 'bin-group');

    this.props.source.on('newdata', () => {
      var range = this.props.range,
          ci = new ContigInterval(range.contig, range.start, range.stop);
      this.setState({
        reads: this.props.source.getAlignmentsInRange(ci)
      });
    });
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
        !shallowEquals(this.state, prevState)) {
      this.visualizeCoverage();
    }
  }

  /**
   * Extract summary statistics from the read data.
   */
  extractSummaryStatistics(reads: Array<SamRead>, range: types.GenomeRange) {
    // Keep track of the start/stop points of our view
    var rstart = range.start - 1,  // this is to account for 0 vs 1-based pos.
        rstop = range.stop;
    // Create an array to keep track of all counts for each of the positions
    var binCounts = _.range(rstart, rstop + 1).map(() => 0);

    // This is written in an imperative style (instead of with _.groupBy)
    // as an optimization.
    _.each(this.state.reads, read => {
      var interval = read.getInterval().interval,
          istart = interval.start,
          istop = interval.stop;

      for (var j = Math.max(istart, rstart);  // don't go beyond start
          j <= Math.min(istop, rstop);  // don't go beyond stop
          j++) {
        binCounts[j - rstart] += 1;
      }
    });
    var maxCoverage = _.max(binCounts);

    // This will convert the array into an array of objects with positions
    // where the position will be used a unique key
    binCounts = _.map(binCounts,
      (val, idx) => ({position: rstart + idx + 1, count: val})
    );

    return {binCounts, maxCoverage};
  }

  visualizeCoverage() {
    var div = this.refs.container.getDOMNode(),
        width = this.state.width,
        height = this.state.height,
        range = this.props.range,
        reads = this.state.reads,
        padding = this.state.labelSize.height / 2,  // half the text height
        xScale = this.getScale(),
        svg = d3.select(div).select('svg');

    // Hold off until height & width are known.
    if (width === 0) return;

    svg.attr('width', width).attr('height', height);

    var {binCounts, maxCoverage} = this.extractSummaryStatistics(reads, range);
    var yScale = d3.scale.linear()
      .domain([maxCoverage, 0])  // mind the inverted axis
      .range([padding, height - padding])
      .nice();
    // The nice() call on the axis will give us a new domain to work with
    // Let's get our domain max back from the nicified scale
    var axisMax = yScale.domain()[0];
    // Select the group we created first
    var histBars = svg.select('g.bin-group').selectAll('rect.bin')
      .data(binCounts, d => d.position);

    var calcBarHeight = d => Math.max(0, yScale(axisMax - d.count)),
        calcBarPosY = d => yScale(d.count) - yScale(axisMax),
        calcBarWidth = d => xScale(d.position) - xScale(d.position - 1);

    // D3 logic for our histogram bars
    histBars
      .enter()
      .append('rect')
      .attr('class', 'bin');
    histBars
      .attr('x', d => xScale(d.position))
      .attr('y', calcBarPosY)
      .attr('width', calcBarWidth)
      .attr('height', calcBarHeight)
    histBars.exit().remove();

    // Logic for our axis
    var yAxis = d3.svg.axis()
      .scale(yScale)
      .orient('right')  // this is gonna be at the far left
      .innerTickSize(5)  // Make our ticks much more visible
      .outerTickSize(0)  // Remove the default range ticks (they are ugly)
      .tickFormat(t => t + 'X')  // X -> times in coverage terminology
      .tickValues([0, Math.round(axisMax / 2), axisMax]);  // show min, avg, max
    var yAxisEl = svg.selectAll('g.y-axis');
    if (yAxisEl.empty()) {  // no axis element yet
      svg.append('rect').attr('class', 'y-axis-background');
      // add this the second so it is on top of the background
      svg.append('g').attr('class', 'y-axis');
    } else {
      yAxisEl.call(yAxis);  // update the axis
    }
  }
}

NonEmptyCoverageTrack.propTypes = {
  range: types.GenomeRange.isRequired,
  source: React.PropTypes.object.isRequired,
  referenceSource: React.PropTypes.object.isRequired,
  onRangeChange: React.PropTypes.func.isRequired
};


var EmptyTrack = React.createClass({
  render: function() {
    return <div className='coverage empty'>Zoom in to see the coverage</div>;
  }
});

module.exports = CoverageTrack;

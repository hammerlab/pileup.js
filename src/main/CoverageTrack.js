/**
 * Pileup visualization of BAM sources.
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
    _ = require("underscore"),
    {addToPileup, getOpInfo, CigarOp} = require('./pileuputils'),
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
      reads: []
    };
  }

  render(): any {
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
    var range = this.props.range,
        width = this.state.width,
        offsetPx = range.offsetPx || 0;
    var scale = d3.scale.linear()
            .domain([range.start, range.stop + 1])  // 1 bp wide
            .range([-offsetPx, width - offsetPx]);
    return scale;
  }

  updateSize() {
    var parentDiv = this.refs.container.getDOMNode();
    this.setState({
      width: parentDiv.parentNode.offsetWidth,
      height: parentDiv.offsetHeight
    });
  }

  componentDidMount() {
    window.addEventListener('resize', () => this.updateSize());
    this.updateSize();

    var div = this.refs.container.getDOMNode();
    d3.select(div).append('svg');

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

  visualizeCoverage() {
    var div = this.refs.container.getDOMNode(),
        width = this.state.width,
        height = this.state.height,
        range = this.props.range,
        xScale = this.getScale(),
        svg = d3.select(div).select('svg');

    // Hold off until height & width are known.
    if (width === 0) return;

    svg
      .attr('width', width)
      .attr('height', height);

    var binCounts = _.chain(this.state.reads)
      .map(read => read.getInterval().interval)
      .map(interval => _.range(interval.start, interval.stop+1))
      .flatten()
      .countBy()
      .pairs()
      .map(c => ({key: c[0], count: c[1]}))
      .value();

    var maxVal = _.chain(binCounts).map(b => b.count).max().value();
    var yScale = d3.scale.linear()
      .domain([0, maxVal])
      .range([0, height]);

    var histBars = svg.selectAll("rect.covbin").data(binCounts, d => d.key);

    histBars
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.key))
      .attr('y', d => yScale(maxVal-d.count))
      .attr('width', d => xScale(d.key) - xScale(d.key-1))
      .attr('height', d => yScale(d.count))
      .attr('class', 'covbin');

    histBars
      .attr('x', d => xScale(d.key))
      .attr('y', d => yScale(maxVal-d.count))
      .attr('width', d => xScale(d.key) - xScale(d.key-1))
      .attr('height', d => yScale(d.count))

    histBars.exit().remove();
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
    return <div className='coverage empty'>Zoom in to see alignments</div>;
  }
});

module.exports = CoverageTrack;

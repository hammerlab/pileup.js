/**
 * Pileup visualization of BAM sources.
 * @flow
 */
'use strict';

import type * as SamRead from './SamRead';

var React = require('react/addons'),
    _ = require('underscore'),
    d3 = require('d3'),
    types = require('./types'),
    Interval = require('./Interval'),
    {pileup} = require('./pileuputils');

var PileupTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    reads: React.PropTypes.array.isRequired,
    onRangeChange: React.PropTypes.func.isRequired
  },
  render: function(): any {
    var range = this.props.range;
    if (!range) {
      return <EmptyTrack />;
    }

    return <NonEmptyPileupTrack {...this.props} />;
  }
});


var READ_HEIGHT = 13;
var READ_SPACING = 2;  // vertical pixels between reads

var READ_STRAND_ARROW_WIDTH = 6;

// Returns an SVG path string for the read, with an arrow indicating strand.
function makePath(read, scale, row) {
  var left = scale(read.pos),
      top = row * (READ_HEIGHT + READ_SPACING),
      right = scale(read.pos + read.l_seq) - 5,
      bottom = top + READ_HEIGHT,
      path = read.getStrand() == '+' ? [
        [left, top],
        [right - READ_STRAND_ARROW_WIDTH, top],
        [right, (top + bottom) / 2],
        [right - READ_STRAND_ARROW_WIDTH, bottom],
        [left, bottom]
      ] : [
        [right, top],
        [left + READ_STRAND_ARROW_WIDTH, top],
        [left, (top + bottom) / 2],
        [left + READ_STRAND_ARROW_WIDTH, bottom],
        [right, bottom]
      ];
  return d3.svg.line()(path);
}

function readClass(read) {
  return 'alignment' + (read.getStrand() == '-' ? ' negative' : ' positive');
}

var NonEmptyPileupTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange.isRequired,
    reads: React.PropTypes.array.isRequired,
    onRangeChange: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    return {
      width: 0,
      height: 0
    };
  },
  render: function(): any {
    return <div className='pileup'></div>;
  },
  componentDidMount: function() {
    var div = this.getDOMNode();
    this.setState({
      width: div.offsetWidth,
      height: div.offsetWidth
    });
    d3.select(div)
      .append('svg');
    this.updateVisualization();
  },
  getScale: function() {
    var range = this.props.range,
        width = this.state.width,
        offsetPx = range.offsetPx || 0;
    var scale = d3.scale.linear()
            .domain([range.start, range.stop + 1])  // 1 bp wide
            .range([-offsetPx, width - offsetPx]);
    return scale;
  },
  componentDidUpdate: function(prevProps: any, prevState: any) {
    // Check a whitelist of properties which could change the visualization.
    // TODO: this is imprecise; it would be better to deep check reads.
    var newProps = this.props;
    if (!_.isEqual(newProps.reads, prevProps.reads) ||
        !_.isEqual(newProps.range, prevProps.range) ||
       prevState != this.state) {
      this.updateVisualization();
    }
  },
  updateVisualization: function() {
    var div = this.getDOMNode(),
        width = this.state.width,
        height = this.state.height,
        svg = d3.select(div).select('svg');

    // Hold off until height & width are known.
    if (width === 0) return;

    var scale = this.getScale();

    var rows = pileup(this.props.reads.map(
        r => new Interval(r.pos, r.pos + r.l_seq)));

    svg.attr('width', width)
       .attr('height', height);

    var reads = svg.selectAll('path.alignment')
       .data(this.props.reads, read => read.offset.toString());

    // Enter
    reads.enter()
        .append('path')
        .attr('class', readClass);

    // Update
    reads.attr('d', (read, i) => makePath(read, scale, rows[i]));

    // Exit
    reads.exit().remove();
  }

});


var EmptyTrack = React.createClass({
  render: function() {
    return <div className='pileup empty'>Zoom in to see alignments</div>;
  }
});

module.exports = PileupTrack;

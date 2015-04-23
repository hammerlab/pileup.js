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

    var reads = svg.selectAll('rect.alignment')
       .data(this.props.reads, read => read.offset.toString());

    // Enter
    reads.enter()
        .append('rect')
        .attr('class', 'alignment');

    // Update
    reads.attr({
      'x': read => scale(read.pos),
      'y': (read, i) => rows[i] * (READ_HEIGHT + READ_SPACING),
      'width': read => (scale(read.pos + read.l_seq) - scale(read.pos) - 5),
      'height': READ_HEIGHT
    });

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

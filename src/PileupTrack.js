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
    {addToPileup} = require('./pileuputils');

var PileupTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    reads: React.PropTypes.array.isRequired,
    onRangeChange: React.PropTypes.func.isRequired,
    basePairs: React.PropTypes.object
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
function makePath(scale, visualRead: VisualAlignment) {
  var read = visualRead.read,
      left = scale(visualRead.read.pos),
      top = visualRead.row * (READ_HEIGHT + READ_SPACING),
      right = scale(read.pos + visualRead.refLength) - 5,
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

// This bundles everything intrinsic to the alignment that we need to display
// it, i.e. everything not dependend on scale/viewport.
type VisualAlignment = {
  read: SamRead;
  strand: number;  // see Strand below
  row: number;  // pileup row.
  refLength: number;  // span on the reference (accounting for indels)
};
var Strand = {
  POSITIVE: 0,
  NEGATIVE: 1
};

// TODO: scope to PileupTrack
var pileup = [];
var keyToVisualAlignment = {};

// Attach visualization info to the read and cache it.
function addRead(read: SamRead) {
  var k = read.offset.toString();
  if (k in keyToVisualAlignment) return;

  // assign this read to a row in the pileup
  keyToVisualAlignment[k] = {
    read: read,
    strand: read.getStrand() == '+' ? Strand.POSITIVE : Strand.NEGATIVE,
    row: addToPileup(new Interval(read.pos, read.pos + read.l_seq), pileup),
    refLength: read.getReferenceLength()
  };
}

var NonEmptyPileupTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange.isRequired,
    reads: React.PropTypes.array.isRequired,
    basePairs: React.PropTypes.object,
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

    svg.attr('width', width)
       .attr('height', height);

    var reads = svg.selectAll('path.alignment')
       .data(this.props.reads, read => read.offset.toString());

    // Enter
    reads.enter()
        .append('path')
        .attr('class', readClass)
        .each(addRead)
        .on('click', (read, i) => {
          window.alert(read.debugString());
        });

    // Update
    reads.attr('d', (read, i) => makePath(scale, keyToVisualAlignment[read.offset.toString()]));

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

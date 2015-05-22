/**
 * A track which displays a reference genome.
 * @flow
 */
'use strict';

var React = require('./react-shim'),
    _ = require('underscore'),
    d3 = require('d3'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    utils = require('./utils');


var GenomeTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    source: React.PropTypes.object.isRequired,
    onRangeChange: React.PropTypes.func.isRequired,
    cssClass: React.PropTypes.string
  },
  render: function(): any {
    var range = this.props.range;
    if (!range) {
      return <EmptyTrack />;
    }

    return <NonEmptyGenomeTrack {...this.props} />;
  }
});

// Individual base pairs are rendered differently depending on the scale.
var DisplayMode = {
  LOOSE: 1,   // Lots of space -- a big font is OK.
  TIGHT: 2,   // Letters need to be shrunk to fit.
  BLOCKS: 3,  // Change from letters to blocks of color
  HIDDEN: 4
};

var NonEmptyGenomeTrack = React.createClass({
  // This prevents updates if state & props have not changed.
  mixins: [React.addons.PureRenderMixin],

  propTypes: {
    range: types.GenomeRange.isRequired,
    source: React.PropTypes.object.isRequired,
    onRangeChange: React.PropTypes.func.isRequired,
    cssClass: React.PropTypes.string
  },
  getInitialState: function() {
    return {
      width: 0,
      height: 0,
      basePairs: []
    };
  },
  render: function(): any {
    var className = ['reference', this.props.cssClass || ''].join(' ');
    return <div className={className}></div>;
  },
  updateSize: function() {
    var div = this.getDOMNode();
    this.setState({
      width: div.offsetWidth,
      height: div.offsetHeight
    });
  },
  componentDidMount: function() {
    window.addEventListener('resize', () => this.updateSize());
    this.updateSize();

    var div = this.getDOMNode(),
        svg = d3.select(div)
                .append('svg');

    // Visualize new reference data as it comes in from the network.
    this.props.source.on('newdata', () => {
      this.updateVisualization();
    });

    var originalRange, originalScale, dx=0;
    var dragstarted = () => {
      d3.event.sourceEvent.stopPropagation();
      dx = 0;
      originalRange = _.clone(this.props.range);
      originalScale = this.getScale();
    };
    var updateRange = () => {
      if (!originalScale) return;  // can never happen, but Flow don't know.
      if (!originalRange) return;  // can never happen, but Flow don't know.
      var newStart = originalScale.invert(-dx),
          intStart = Math.round(newStart),
          offsetPx = originalScale(newStart) - originalScale(intStart);

      var newRange = {
        contig: originalRange.contig,
        start: intStart,
        stop: intStart + (originalRange.stop - originalRange.start),
        offsetPx: offsetPx
      };
      this.props.onRangeChange(newRange);
    };
    var dragmove = () => {
      dx += d3.event.dx;  // these are integers, so no roundoff issues.
      updateRange();
    };
    function dragended() {
      updateRange();
    }

    var drag = d3.behavior.drag()
        .on('dragstart', dragstarted)
        .on('drag', dragmove)
        .on('dragend', dragended);

    var g = svg.append('g')
               .attr('class', 'wrapper')
               .call(drag);

    g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('class', 'background');

    this.updateVisualization();
  },
  getScale: function() {
    var div = this.getDOMNode(),
        range = this.props.range,
        width = div.offsetWidth,
        offsetPx = range.offsetPx || 0;
    var scale = d3.scale.linear()
            .domain([range.start, range.stop + 1])  // 1 bp wide
            .range([-offsetPx, width - offsetPx]);
    return scale;
  },
  componentDidUpdate: function(prevProps: any, prevState: any) {
    if (!shallowEquals(prevProps, this.props) ||
        !shallowEquals(prevState, this.state)) {
      this.updateVisualization();
    }
  },
  updateVisualization: function() {
    var div = this.getDOMNode(),
        range = this.props.range,
        width = this.state.width,
        height = this.state.height,
        svg = d3.select(div).select('svg');

    // Hold off until height & width are known.
    if (width === 0) return;

    var scale = this.getScale();
    var pxPerLetter = scale(1) - scale(0);
    var mode = this.getDisplayMode(pxPerLetter);

    var basePairs = this.props.source.getRange({
      contig: range.contig,
      start: Math.max(0, range.start - 1),
      stop: range.stop
    });

    var contigColon = this.props.range.contig + ':';
    var absBasePairs;
    if (mode != DisplayMode.HIDDEN) {
      absBasePairs = _.range(range.start - 1, range.stop + 1)
          .map(locus => ({
            pos: locus,
            letter: basePairs[contigColon + locus]
          }));
    } else {
      absBasePairs = [];  // TODO: show a "zoom out" message.
    }

    svg.attr('width', width)
       .attr('height', height);
    svg.select('rect').attr({width, height});

    var g = svg.select('g.wrapper');

    var letter = g.selectAll('.pair')
       .data(absBasePairs, bp => bp.pos);

    // Enter
    var basePairGs = letter.enter()
      .append('g');
    // TODO: look into only creating one or the other of these -- only one is ever visible.
    basePairGs.append('text');
    basePairGs.append('rect');
    
    var baseClass = (mode == DisplayMode.LOOSE ? 'loose' :
                     mode == DisplayMode.TIGHT ? 'tight' : 'blocks');

    // Enter & update
    letter.attr('class', 'pair ' + baseClass);

    letter.select('text')
        .attr('x', bp => scale(1 + 0.5 + bp.pos))  // 0.5 = centered
        .attr('y', height)
        .attr('class', bp => utils.basePairClass(bp.letter))
        .text(bp => bp.letter);

    letter.select('rect')
        .attr('x', bp => scale(1 + bp.pos))
        .attr('y', height - 14)
        .attr('height', 14)
        .attr('width', pxPerLetter - 1)
        .attr('class', bp => utils.basePairClass(bp.letter));

    // Exit
    letter.exit().remove();
  },

  getDisplayMode(pxPerLetter): number {
    if (pxPerLetter >= 25) {
      return DisplayMode.LOOSE;
    } else if (pxPerLetter >= 10) {
      return DisplayMode.TIGHT;
    } else if (pxPerLetter >= 1) {
      return DisplayMode.BLOCKS;
    } else {
      return DisplayMode.HIDDEN;
    }
  }
});

var EmptyTrack = React.createClass({
  render: function() {
    return <div className="reference empty">Zoom in to see bases</div>;
  }
});

module.exports = GenomeTrack;

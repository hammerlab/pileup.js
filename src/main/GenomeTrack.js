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
    utils = require('./utils'),
    DisplayMode = require('./DisplayMode');


var GenomeTrack = React.createClass({
  displayName: 'reference',
  propTypes: {
    range: types.GenomeRange,
    source: React.PropTypes.object.isRequired,
    onRangeChange: React.PropTypes.func.isRequired,
  },
  render: function(): any {
    var range = this.props.range;
    if (!range) {
      return <EmptyTrack />;
    }

    return <NonEmptyGenomeTrack {...this.props} />;
  }
});

var NonEmptyGenomeTrack = React.createClass({
  // This prevents updates if state & props have not changed.
  mixins: [React.addons.PureRenderMixin],

  propTypes: {
    range: types.GenomeRange.isRequired,
    source: React.PropTypes.object.isRequired,
    onRangeChange: React.PropTypes.func.isRequired,
  },
  getInitialState: function() {
    return {
      width: 0,
      height: 0,
      basePairs: []
    };
  },
  render: function(): any {
    return <div></div>;
  },
  updateSize: function() {
    var parentDiv = this.getDOMNode().parentNode;
    this.setState({
      width: parentDiv.offsetWidth,
      height: parentDiv.offsetHeight
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
    var width = this.getDOMNode().offsetWidth;
    return utils.getTrackScale(this.props.range, this.state.width);
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
    var mode = DisplayMode.getDisplayMode(pxPerLetter);

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

    var baseClass = DisplayMode.toString(mode),
        showText = DisplayMode.isText(mode),
        modeData = [mode],
        modeWrapper = g.selectAll('.mode-wrapper').data(modeData, x => x);
    modeWrapper.enter().append('g').attr('class', 'mode-wrapper ' + baseClass);
    modeWrapper.exit().remove();

    var letter = modeWrapper.selectAll('.basepair')
       .data(absBasePairs, bp => bp.pos);

    // Enter
    var basePairGs = letter.enter()
      .append(showText ? 'text' : 'rect');

    // Enter & update

    if (showText) {
      letter
          .attr('x', bp => scale(1 + 0.5 + bp.pos))  // 0.5 = centered
          .attr('y', height)
          .attr('class', bp => utils.basePairClass(bp.letter))
          .text(bp => bp.letter);
    } else {
      letter
          .attr('x', bp => scale(1 + bp.pos))
          .attr('y', height - 14)
          .attr('height', 14)
          .attr('width', pxPerLetter - 1)
          .attr('class', bp => utils.basePairClass(bp.letter));
    }

    // Exit
    letter.exit().remove();
  }
});

var EmptyTrack = React.createClass({
  render: function() {
    return <div className="reference empty">Zoom in to see bases</div>;
  }
});

module.exports = GenomeTrack;

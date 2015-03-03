/**
 * A track which displays a reference genome.
 * @flow
 */

var React = require('react'),
    _ = require('underscore'),
    d3 = require('d3'),
    types = require('./types');

var GenomeTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    basePairs: React.PropTypes.string,
    onRangeChange: React.PropTypes.func.isRequired
  },
  render: function(): any {
    var range = this.props.range;
    if (!range) {
      return <EmptyTrack />;
    }
    var rangeLength = range.limit - range.start;
    if (rangeLength > 200) {
      return <EmptyTrack />;
    }

    if (!this.props.basePairs) {
      return <div className="reference empty">no data</div>;
    }

    return <NonEmptyGenomeTrack {...this.props} />;
  }
});

var NonEmptyGenomeTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange.isRequired,
    basePairs: React.PropTypes.string.isRequired,
    onRangeChange: React.PropTypes.func.isRequired
  },
  render: function(): any {
    return <div className="reference"></div>;
  },
  componentDidMount: function() {
    var div = this.getDOMNode(),
        svg = d3.select(div)
                .append('svg');

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
        .on("dragstart", dragstarted)
        .on("drag", dragmove)
        .on("dragend", dragended);

    var g = svg.append('g')
               .call(drag);

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
    this.updateVisualization();
  },
  updateVisualization: function() {
    var div = this.getDOMNode(),
        range = this.props.range,
        width = div.offsetWidth,
        height = div.offsetHeight,
        svg = d3.select(div).select('svg');

    var scale = this.getScale();

    var absBasePairs = [].map.call(this.props.basePairs, (bp, i) => ({
      position: i + range.start,
      letter: bp
    }));

    svg.attr('width', width)
       .attr('height', height);

    var g = svg.select('g');

    var letter = g.selectAll('text')
       .data(absBasePairs, bp => bp.position);

    // Enter
    letter.enter().append('text');

    // Enter & update
    letter
        .attr('x', bp => scale(bp.position))
        .attr('y', height)
        .attr('class', bp => 'basepair ' + bp.letter)
        .text(bp => bp.letter);

    // Exit
    letter.exit().remove();
  }
});

var EmptyTrack = React.createClass({
  render: function() {
    return <div className="reference empty">Zoom in to see bases</div>
  }
});

module.exports = GenomeTrack;

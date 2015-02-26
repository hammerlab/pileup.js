/**
 * A track which displays a reference genome.
 * @flow
 */

var React = require('react'),
    d3 = require('d3'),
    types = require('./types');

var GenomeTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    basePairs: React.PropTypes.string
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
    basePairs: React.PropTypes.string.isRequired
  },
  render: function(): any {
    return <div className="reference"></div>;
  },
  componentDidMount: function() {
    var svg = d3.select(this.getDOMNode())
                .append('svg');
    this.updateVisualization();
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

    var scale = d3.scale.linear()
            .domain([range.start, range.stop + 1])  // 1 bp wide
            .range([0, width]);

    var absBasePairs = [].map.call(this.props.basePairs, (bp, i) => ({
      position: i + range.start,
      letter: bp
    }));

    svg.attr('width', width)
       .attr('height', height);

    var letter = svg.selectAll('text')
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

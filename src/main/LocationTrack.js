/**
 * A track which shows the location of the base in the middle of the view.
 * @flow
 */
'use strict';

var React = require('./react-shim'),
    _ = require('underscore'),
    d3 = require('d3'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    d3utils = require('./d3utils');

class LocationTrack extends React.Component {
  constructor(props: Object) {
    super(props);
    this.state = {
      labelSize: {height: 0, width: 0}
    };
  }

  getScale() {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  render(): any {
    return <div ref='container'></div>;
  }

  componentDidMount() {
    var div = this.getDOMNode(),
        svg = d3.select(div).append('svg');

    svg.append('line').attr('class', 'location-hline');
    svg.append('line').attr('class', 'location-vline');

    var label = svg.append('text').attr('class', 'location-label');
    var {height, width} = label.text("0").node().getBBox();
    // Save the size information for precise calculation
    this.setState({
          labelSize: {height: height, width: width}
    });

    this.updateVisualization();
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    this.updateVisualization();
  }

  getDOMNode(): any {
    return this.refs.container.getDOMNode();
  }

  updateVisualization() {
    var div = this.getDOMNode(),
        range = this.props.range,
        width = this.props.width,
        height = this.props.height,
        labelSize = this.state.labelSize,
        svg = d3.select(div).select('svg');

    svg.attr('width', width).attr('height', height);
    var scale = this.getScale();
    var midPoint = (range.stop + range.start) / 2;
    var midX = width / 2,
        midY = height / 2;

    var midLabelFormat = d3.format(',d');
    var midLabel = svg.select('.location-label');
    var labelHeight = labelSize.height;
    var labelPadding = 10;
    midLabel
      .attr('x', midX + labelPadding + (labelSize.width / 2))
      .attr('y', midY + (labelHeight / 3))
      .text(midLabelFormat(Math.floor(midPoint)) + ' bp');

    var midLine = svg.select('.location-vline');
    midLine
      .attr('x1', midX)
      .attr('y1', 0)
      .attr('x2', midX)
      .attr('y2', height);

    var hLine = svg.select('.location-hline');
    hLine
      .attr('x1', midX)
      .attr('y1', midY)
      .attr('x2', midX + labelPadding)
      .attr('y2', midY);
  }
}

LocationTrack.propTypes = {
  range: types.GenomeRange.isRequired,
  onRangeChange: React.PropTypes.func.isRequired,
};
LocationTrack.displayName = 'location';

module.exports = LocationTrack;

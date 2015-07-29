/**
 * A track which shows the location of the base in the middle of the view.
 * @flow
 */
'use strict';

var React = require('./react-shim'),
    d3 = require('d3'),
    EmptySource = require('./EmptySource'),
    types = require('./react-types'),
    d3utils = require('./d3utils');

// This sets the width of the horizontal line (--) that connects the center
//  marker to the label:
//     | |-- 42 bp
var labelPadding = 5,
    connectorWidth = 10;

class LocationTrack extends React.Component {
  constructor(props: Object) {
    super(props);
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
    svg.append('line').attr('class', 'location-vline-left');
    svg.append('line').attr('class', 'location-vline-right');
    svg.append('text').attr('class', 'location-label');

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
        {range, width, height} = this.props,
        scale = this.getScale(),
        svg = d3.select(div).select('svg');

    svg.attr('width', width).attr('height', height);

    var midPoint = Math.floor((range.stop + range.start) / 2),
        rightLineX = scale(midPoint + 1),
        leftLineX = scale(midPoint);

    // We are going to add transition, because the left and right borders
    //  of the middle base tend to change when the ref track is dragged.
    //  Transition will reduce the amount of wiggling for the labels.
    var rightLine = svg.select('.location-vline-right');
    rightLine
      .transition()
      .attr({
        x1: rightLineX,
        y1: 0,
        x2: rightLineX,
        y2: height
      });

    var leftLine = svg.select('.location-vline-left');
    leftLine
      .transition()
      .attr({
        x1: leftLineX,
        y1: 0,
        x2: leftLineX,
        y2: height
      });

    var midLabelFormat = d3.format(',d'),
        midY = height / 2,
        midLabel = svg.select('.location-label');
    midLabel
      .text(midLabelFormat(midPoint) + ' bp')
      .transition()
      .attr({
        x: rightLineX + connectorWidth + labelPadding,
        y: midY
      });

    var hLine = svg.select('.location-hline');
    hLine
      .transition()
      .attr({
        x1: rightLineX,
        y1: midY,
        x2: rightLineX + connectorWidth,
        y2: midY
      });
  }
}

LocationTrack.propTypes = {
  range: types.GenomeRange.isRequired,
  onRangeChange: React.PropTypes.func.isRequired,
};
LocationTrack.displayName = 'location'
LocationTrack.defaultSource = EmptySource.create();

module.exports = LocationTrack;

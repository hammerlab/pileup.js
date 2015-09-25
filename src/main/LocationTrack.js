/**
 * A track which shows the location of the base in the middle of the view.
 * @flow
 */
'use strict';

var React = require('./react-shim'),
    d3 = require('d3'),
    EmptySource = require('./EmptySource'),
    types = require('./react-types'),
    canvasUtils = require('./canvas-utils'),
    dataCanvas = require('./data-canvas'),
    style = require('./style'),
    d3utils = require('./d3utils');

// This sets the width of the horizontal line (--) that connects the center
//  marker to the label:
//     | |-- 42 bp
var LABEL_PADDING = 5,
    CONNECTOR_WIDTH = 10;

class LocationTrack extends React.Component {
  constructor(props: Object) {
    super(props);
  }

  getScale() {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  render(): any {
    return <canvas />;
  }

  componentDidMount() {
    this.updateVisualization();
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    this.updateVisualization();
  }

  getDOMNode(): any {
    return React.findDOMNode(this);
  }

  updateVisualization() {
    var canvas = this.getDOMNode(),
        {range, width, height} = this.props,
        scale = this.getScale();

    d3.select(canvas).attr({width, height});

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(this.getDOMNode()));
    ctx.save();
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var midPoint = Math.floor((range.stop + range.start) / 2),
        rightLineX = scale(midPoint + 1),
        leftLineX = scale(midPoint);

    // Left line
    canvasUtils.drawLine(ctx, rightLineX, 0, rightLineX, height);

    // Right line
    canvasUtils.drawLine(ctx, leftLineX, 0, leftLineX, height);

    // Mid label
    var midLabelFormat = d3.format(',d'),
        midY = height / 2;

    ctx.fillStyle = style.LOC_FONT_COLOR;
    ctx.font = style.LOC_FONT_STYLE;
    ctx.fillText(midLabelFormat(midPoint) + ' bp',
                 rightLineX + style.LOC_TICK_LENGTH + style.LOC_TEXT_PADDING,
                 midY + style.LOC_TEXT_Y_OFFSET);

    // Connect label with the right line
    canvasUtils.drawLine(ctx, rightLineX, midY, rightLineX + style.LOC_TICK_LENGTH, midY);

    // clean up
    ctx.restore();
  }
}

LocationTrack.propTypes = {
  range: types.GenomeRange.isRequired,
  onRangeChange: React.PropTypes.func.isRequired,
};
LocationTrack.displayName = 'location'
LocationTrack.defaultSource = EmptySource.create();

module.exports = LocationTrack;

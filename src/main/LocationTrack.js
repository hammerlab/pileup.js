/**
 * A track which shows the location of the base in the middle of the view.
 * @flow
 */
'use strict';

var React = require('./react-shim'),
    d3 = require('d3'),
    EmptySource = require('./EmptySource'),
    types = require('./react-types'),
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

  getContext(): CanvasRenderingContext2D {
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement);
    // The typecast through `any` is because getContext could return a WebGL context.
    var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
    return ctx;
  }

  render(): any {
    return <canvas ref='canvas' />;
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
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement),
        range = this.props.range,
        width = this.props.width,
        scale = this.getScale(),
        height = this.props.height;

    d3.select(canvas).attr({width, height});

    var ctx = dataCanvas.getDataContext(this.getContext());
    ctx.save();
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var midPoint = Math.floor((range.stop + range.start) / 2),
        rightLineX = scale(midPoint + 1),
        leftLineX = scale(midPoint);

    // Left line
    ctx.beginPath();
    ctx.moveTo(rightLineX, 0);
    ctx.lineTo(rightLineX, height);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(leftLineX, 0);
    ctx.lineTo(leftLineX, height);
    ctx.stroke();

    // Mid label
    var midLabelFormat = d3.format(',d'),
        midY = height / 2;

    ctx.lineWidth = 1;
    ctx.fillStyle = style.LOC_FONT_COLOR;
    ctx.font = style.LOC_FONT_STYLE;
    ctx.fillText(midLabelFormat(midPoint) + ' bp',
                 rightLineX + style.LOC_TICK_LENGTH + style.LOC_TEXT_PADDING,
                 midY + style.LOC_TEXT_Y_OFFSET);

    // Connect label with the right line
    ctx.beginPath();
    ctx.moveTo(rightLineX, midY);
    ctx.lineTo(rightLineX + style.LOC_TICK_LENGTH, midY);
    ctx.stroke();

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

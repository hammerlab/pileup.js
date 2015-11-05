/**
 * A track which shows the location of the base in the middle of the view.
 * @flow
 */
'use strict';

import type {VizProps} from './VisualizationWrapper';

var React = require('react'),
    ReactDOM = require('react-dom'),
    EmptySource = require('./EmptySource'),
    canvasUtils = require('./canvas-utils'),
    dataCanvas = require('data-canvas'),
    style = require('./style'),
    d3utils = require('./d3utils');

class LocationTrack extends (React.Component : typeof ReactComponent) {
  props: VizProps;
  state: void;  // no state
  static defaultSource: Object;

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

  updateVisualization() {
    var canvas = ReactDOM.findDOMNode(this),
        {range, width, height} = this.props,
        scale = this.getScale();

    d3utils.sizeCanvas(canvas, width, height);

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));
    ctx.save();
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var midPoint = Math.floor((range.stop + range.start) / 2),
        rightLineX = Math.round(scale(midPoint + 1)),
        leftLineX = Math.round(scale(midPoint));

    // Left line
    canvasUtils.drawLine(ctx, leftLineX - 0.5, 0, leftLineX - 0.5, height);

    // Right line
    canvasUtils.drawLine(ctx, rightLineX - 0.5, 0, rightLineX - 0.5, height);

    // Mid label
    var midY = height / 2;

    ctx.fillStyle = style.LOC_FONT_COLOR;
    ctx.font = style.LOC_FONT_STYLE;
    ctx.fillText(midPoint.toLocaleString() + ' bp',
                 rightLineX + style.LOC_TICK_LENGTH + style.LOC_TEXT_PADDING,
                 midY + style.LOC_TEXT_Y_OFFSET);

    // Connect label with the right line
    canvasUtils.drawLine(ctx, rightLineX - 0.5, midY - 0.5, rightLineX + style.LOC_TICK_LENGTH - 0.5, midY - 0.5);

    // clean up
    ctx.restore();
  }
}

LocationTrack.displayName = 'location';
LocationTrack.defaultSource = EmptySource.create();

module.exports = LocationTrack;

/**
 * A track which shows the location of the base in the middle of the view.
 * @flow
 */
'use strict';

import type {VizProps} from '../VisualizationWrapper';
import type {Scale} from './d3utils';

import React from 'react';
import ReactDOM from 'react-dom';
import EmptySource from '../sources/EmptySource';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import style from '../style';
import d3utils from './d3utils';
import copyToClipboard from '../Clipboard';

class LocationTrack extends React.Component {
  props: VizProps;
  state: void;  // no state
  static defaultSource: Object;

  constructor(props: Object) {
    super(props);
    this.state = {
      midpoint: ""
    };
  }

  getScale(): Scale {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  render(): any {
    return <canvas ref='canvas' onClick={this.handleClick.bind(this)} />;
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

    this.state.midpoint = midPoint;

    // Left line
    canvasUtils.drawLine(ctx, leftLineX - 0.5, 0, leftLineX - 0.5, height);

    // Right line
    canvasUtils.drawLine(ctx, rightLineX - 0.5, 0, rightLineX - 0.5, height);

    // Mid label
    var midY = height / 2;

    ctx.fillStyle = style.LOC_FONT_COLOR;
    ctx.font = style.LOC_FONT_STYLE;
    ctx.fillText(midPoint.toLocaleString(), //  + ' bp',
                 rightLineX + style.LOC_TICK_LENGTH + style.LOC_TEXT_PADDING,
                 midY + style.LOC_TEXT_Y_OFFSET);

    // Connect label with the right line
    canvasUtils.drawLine(ctx, rightLineX - 0.5, midY - 0.5, rightLineX + style.LOC_TICK_LENGTH - 0.5, midY - 0.5);

    // clean up
    ctx.restore();
  }

  handleClick(reactEvent: any) {
    copyToClipboard(this.state.midpoint);
  }
}

LocationTrack.displayName = 'location';
LocationTrack.defaultSource = EmptySource.create();

module.exports = LocationTrack;

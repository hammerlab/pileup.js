/**
 * A track which shows a scale proportional to slice of the genome being
 * shown by the reference track. This track tries to show a scale in kbp,
 * mbp or gbp depending on the size of the view and also tries to round the
 * scale size (e.g. prefers "1,000 bp", "1,000 kbp" over "1 kbp" and "1 mbp")
 *
 *           <---------- 30 bp ---------->
 *
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

class ScaleTrack extends React.Component {
  props: VizProps;
  state: void;  // no state
  static defaultSource: Object;

  constructor(props: Object) {
    super(props);
  }

  getScale(): Scale {
    return d3utils.getTrackScale(this.props.range, this.props.width);
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
    return ReactDOM.findDOMNode(this);
  }

  updateVisualization() {
    var canvas = this.getDOMNode(),
        {range, width, height} = this.props;

    d3utils.sizeCanvas(canvas, width, height);

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));
    ctx.save();
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var viewSize = range.stop - range.start + 1,
        midX = Math.round(width / 2),
        midY = Math.round(height / 2);

    // Mid label
    var {prefix, unit} = d3utils.formatRange(viewSize);
    ctx.lineWidth = 1;
    ctx.fillStyle = style.SCALE_FONT_COLOR;
    ctx.font = style.SCALE_FONT_STYLE;
    ctx.textAlign = "center";
    ctx.fillText(prefix + " " + unit,
                 midX,
                 midY + style.SCALE_TEXT_Y_OFFSET);

    // Left line
    canvasUtils.drawLine(ctx, 0.5, midY - 0.5, midX - style.SCALE_LINE_PADDING - 0.5, midY - 0.5);
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(0.5 + style.SCALE_ARROW_SIZE, midY - style.SCALE_ARROW_SIZE - 0.5);
    ctx.lineTo(0.5, midY - 0.5);
    ctx.lineTo(0.5 + style.SCALE_ARROW_SIZE, midY + style.SCALE_ARROW_SIZE - 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right line
    canvasUtils.drawLine(ctx, midX + style.SCALE_LINE_PADDING - 0.5, midY - 0.5, width - 0.5, midY - 0.5);
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(width - style.SCALE_ARROW_SIZE - 0.5, midY - style.SCALE_ARROW_SIZE - 0.5);
    ctx.lineTo(width - 0.5, midY - 0.5);
    ctx.lineTo(width - style.SCALE_ARROW_SIZE - 0.5, midY + style.SCALE_ARROW_SIZE - 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Clean up afterwards
    ctx.restore();
  }
}

ScaleTrack.displayName = 'scale';
ScaleTrack.defaultSource = EmptySource.create();

module.exports = ScaleTrack;

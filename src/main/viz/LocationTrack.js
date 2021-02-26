/**
 * A track which shows the location of the base in the middle of the view.
 * @flow
 */
'use strict';

import type {VizProps} from '../VisualizationWrapper';
import type {Scale} from './d3utils';
import type {State} from '../types';
import React from 'react';
import EmptySource from '../sources/EmptySource';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import style from '../style';
import d3utils from './d3utils';

class LocationTrack extends React.Component<VizProps<void>, State> {
  props: VizProps<void>;
  state: State;  // state not used, here to make flow happy
  ref: Object;
  static defaultSource: Object;

  constructor(props: VizProps<void>) {
    super(props);
    this.ref = React.createRef();
  }

  getScale(): Scale {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  render(): any {
    return <canvas ref={this.ref} />;
  }

  componentDidMount() {
    this.updateVisualization();
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    this.updateVisualization();
  }

  updateVisualization() {
    const canvas = this.ref.current;
    var  {range, width, height} = this.props,
        scale = this.getScale();

    if (canvas && canvas instanceof Element) { // check for getContext
      if (canvas instanceof HTMLCanvasElement) { // check for sizeCanvas
        d3utils.sizeCanvas(canvas, width, height);
      }
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
    } // end typecheck for canvas
  }
}

LocationTrack.displayName = 'location';
LocationTrack.defaultSource = EmptySource.create();

module.exports = LocationTrack;

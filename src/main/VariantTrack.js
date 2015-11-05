/**
 * Visualization of variants
 * @flow
 */
'use strict';

import type {VcfDataSource} from './VcfDataSource';
import type {Variant} from './vcf';
import type {DataCanvasRenderingContext2D} from 'data-canvas';
import type {VizProps} from './VisualizationWrapper';

var React = require('react'),
    ReactDOM = require('react-dom');

var d3utils = require('./d3utils'),
    shallowEquals = require('shallow-equals'),
    ContigInterval = require('./ContigInterval'),
    canvasUtils = require('./canvas-utils'),
    dataCanvas = require('data-canvas'),
    style = require('./style');


class VariantTrack extends (React.Component : typeof ReactComponent) {
  props: VizProps & {source: VcfDataSource};
  state: void;  // no state

  constructor(props: Object) {
    super(props);
  }

  render(): any {
    return <canvas onClick={this.handleClick} />;
  }

  componentDidMount() {
    this.updateVisualization();

    this.props.source.on('newdata', () => {
      this.updateVisualization();
    });
  }

  getScale() {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(prevProps, this.props) ||
        !shallowEquals(prevState, this.state)) {
      this.updateVisualization();
    }
  }

  updateVisualization() {
    var canvas = ReactDOM.findDOMNode(this),
        {width, height} = this.props;

    // Hold off until height & width are known.
    if (width === 0) return;

    d3utils.sizeCanvas(canvas, width, height);
    var ctx = canvasUtils.getContext(canvas);
    var dtx = dataCanvas.getDataContext(ctx);
    this.renderScene(dtx);
  }

  renderScene(ctx: DataCanvasRenderingContext2D) {
    var range = this.props.range,
        interval = new ContigInterval(range.contig, range.start, range.stop),
        variants = this.props.source.getFeaturesInRange(interval),
        scale = this.getScale(),
        height = this.props.height,
        y = height - style.VARIANT_HEIGHT - 1;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.reset();
    ctx.save();

    ctx.fillStyle = style.VARIANT_FILL;
    ctx.strokeStyle = style.VARIANT_STROKE;
    variants.forEach(variant => {
      ctx.pushObject(variant);
      var x = Math.round(scale(variant.position));
      var width = Math.round(scale(variant.position + 1)) - 1 - x;
      ctx.fillRect(x - 0.5, y - 0.5, width, style.VARIANT_HEIGHT);
      ctx.strokeRect(x - 0.5, y - 0.5, width, style.VARIANT_HEIGHT);
      ctx.popObject();
    });

    ctx.restore();
  }

  handleClick(reactEvent: any) {
    var ev = reactEvent.nativeEvent,
        x = ev.offsetX,
        y = ev.offsetY,
        canvas = ReactDOM.findDOMNode(this),
        ctx = canvasUtils.getContext(canvas),
        trackingCtx = new dataCanvas.ClickTrackingContext(ctx, x, y);
    this.renderScene(trackingCtx);
    var variant = trackingCtx.hit && trackingCtx.hit[0];
    var alert = window.alert || console.log;
    if (variant) {
      alert(JSON.stringify(variant));
    }
  }
}

VariantTrack.displayName = 'variants';

module.exports = VariantTrack;

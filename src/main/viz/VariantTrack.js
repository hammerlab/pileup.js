/**
 * Visualization of variants
 * @flow
 */
'use strict';

import type {VcfDataSource} from '../sources/VcfDataSource';
import type {Variant} from '../data/vcf';
import type {DataCanvasRenderingContext2D} from 'data-canvas';
import type {VizProps} from '../VisualizationWrapper';
import type {Scale} from './d3utils';

import React from 'react';
import ReactDOM from 'react-dom';
import Modal from  'react-bootstrap/lib/Modal';
import Button from  'react-bootstrap/lib/Button';

import d3utils from './d3utils';
import shallowEquals from 'shallow-equals';
import ContigInterval from '../ContigInterval';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import style from '../style';


class VariantTrack extends React.Component {
  props: VizProps & {source: VcfDataSource, 
                     variantHeightByFrequency: boolean,
                     getPopupTitleByVariantId: Object,
                     getPopupContentByVariantId: Object
                     };
  state: {showPopup: boolean,
          selectedVariantPopupContent: ?Object,
          selectedVariantPopupTitle: ?Object};

  constructor(props: Object) {
    super(props);
    this.state = {showPopup: false, 
      selectedVariantPopupContent: null,
      selectedVariantPopupTitle: null};
  }

  render(): any {
    return <div>
      <canvas id="x" onClick={this.handleClick.bind(this)} />
      <Modal show={this.state.showPopup} onHide={this.closePopup.bind(this)}>
          <Modal.Header closeButton>
            <Modal.Title dangerouslySetInnerHTML={{__html: this.state.selectedVariantPopupTitle}}/>
          </Modal.Header>
          <Modal.Body>
            <h4 dangerouslySetInnerHTML={{__html: this.state.selectedVariantPopupContent}}/>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.closePopup.bind(this)}>Close</Button>
          </Modal.Footer>
      </Modal>
    </div>;
  }

  closePopup() {
      this.setState({ showPopup: false });
  }

  openPopup() {
    this.setState({ showPopup: true });
  }

  componentDidMount() {
    this.updateVisualization();

    this.props.source.on('newdata', () => {
      this.updateVisualization();
    });
  }

  getScale(): Scale {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(prevProps, this.props) ||
        !shallowEquals(prevState, this.state)) {
      this.updateVisualization();
    }
  }

  updateVisualization() {
    var canvas = ReactDOM.findDOMNode(this).firstChild,
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
      var variantHeightRatio = 1.0;
      if (this.props.options.variantHeightByFrequency) {
        if (variant.significantFrequency !== null && variant.significantFrequency !== undefined) {
          variantHeightRatio = variant.significantFrequency;
        }
      }
      var height = style.VARIANT_HEIGHT*variantHeightRatio;
      var variantY = y - 0.5 + style.VARIANT_HEIGHT - height;
      var variantX = Math.round(scale(variant.position)) - 0.5;
      var width = Math.round(scale(variant.position + 1)) - 0.5 - variantX;

      ctx.pushObject(variant);

      ctx.fillRect(variantX, variantY, width, height);
      ctx.strokeRect(variantX, variantY, width, height);
      ctx.popObject();
    });

    ctx.restore();
  }

  handleClick(reactEvent: any) {
    var ev = reactEvent.nativeEvent,
        x = ev.offsetX,
        y = ev.offsetY,
        canvas = ReactDOM.findDOMNode(this).firstChild,
        ctx = canvasUtils.getContext(canvas),
        trackingCtx = new dataCanvas.ClickTrackingContext(ctx, x, y);
    this.renderScene(trackingCtx);

    var variant = trackingCtx.hit && trackingCtx.hit[0];
    if (variant) {
      var popupContent = variant.ref+" &rarr; "+variant.alt;
      var popupTitle = "Variant "+variant.id+" (contig: "+variant.contig+", position: "+variant.position+")";

      //user provided function for displaying popup title
      if (typeof this.props.options.getPopupTitleByVariantId  === "function") {
        popupTitle = this.props.options.getPopupTitleByVariantId(variant.id, variant.vcfLine);
      }
      //user provided function for displaying popup content
      //user provided function for displaying popup title
      if (typeof this.props.options.getPopupContentByVariantId  === "function") {
        popupContent = this.props.options.getPopupContentByVariantId(variant.id, variant.vcfLine);
      }
      this.setState({ selectedVariantPopupContent: popupContent, selectedVariantPopupTitle: popupTitle });
      this.openPopup();
    }
  }
}

VariantTrack.displayName = 'variants';

module.exports = VariantTrack;

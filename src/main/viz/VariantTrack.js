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

import d3utils from './d3utils';
import shallowEquals from 'shallow-equals';
import ContigInterval from '../ContigInterval';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import style from '../style';


class VariantTrack extends React.Component {
  props: VizProps & {source: VcfDataSource};
  state: void;  // no state

  constructor(props: Object) {
    super(props);
  }

  render(): any {
    return <canvas ref='canvas' onClick={this.handleClick.bind(this)} />;
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
    var canvas = this.refs.canvas,
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
        canvas = this.refs.canvas,
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

var Popup = React.createClass({
  render: () => null,

  domNode: null,

  componentDidMount() {
    this.domNode = document.getElementById('blacklist-popup');
    this.componentDidUpdate();
  },

  componentDidUpdate() {
    React.render(
      <div {...this.props}>{this.props.children}</div>,
      this.domNode
    );
  },

  open() {
    this.domNode.style.display = 'block';
  },

  close() {
    this.domNode.style.display = 'none';
  }
});


class BlacklistTrack extends VariantTrack {
  constructor(props) {
    super(props);
    this.state = {isPopupOpen: false};
  }

  render(): any {
    return (
      <div>
        <canvas ref="canvas" onMouseMove={this.handleMouseMove.bind(this)} onMouseLeave={this.handleMouseLeave.bind(this)} />
        <Popup ref="popup">
            Blacklist entry content
        </Popup>
      </div>
    );
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

    // ctx.fillStyle = style.VARIANT_FILL;
    ctx.strokeStyle = style.VARIANT_STROKE;
    ctx.font = style.TIGHT_TEXT_STYLE;

    // Scan VCF loci to see whether they have variants on both strands or just one.
    // Also, transform the list of variants, groupping them by position.
    var strand = {};
    var locus_var = {};
    variants.forEach(variant => {
      var locus = `${variant.contig}:${variant.position}`;
      if (!strand[locus]) {
        strand[locus] = {};
      }
      strand[locus][variant.filter] = true;

      if (!locus_var[locus]) {
        locus_var[locus] = [];
      }
      locus_var[locus].push(variant);
    });

    Object.keys(locus_var).forEach(locus => {
      ctx.pushObject(locus_var[locus]);
      locus_var[locus].forEach(variant => {
        var locus = `${variant.contig}:${variant.position}`;
        var x = Math.round(scale(variant.position));
        var width = Math.round(scale(variant.position + 1)) - 1 - x;
        var type, bstrand, symbol;
        var vcfdata = variant.vcfLine.split('\t')[7];
        if (vcfdata.match(/OID=/)) { // Ion Torrent black list
          variant.vcfLine.split('\t')[7].split(';').forEach(chunk => {
            let [key, value] = chunk.split('=');
            if (key === 'OID') {
              type = value.split('.')[0];
            }
            if (key === 'BSTRAND') {
              bstrand = value;
            }
          });
          switch (bstrand) {
            case 'F':
              ctx.fillStyle = style.ALIGNMENT_PLUS_STRAND_COLOR;
            break;
            case 'R':
              ctx.fillStyle = style.ALIGNMENT_MINUS_STRAND_COLOR;
            break;
            default:
              ctx.fillStyle = 'white';
          }
          switch (type) {
            case 'SSE_SNP':
              symbol = 'S';
            break;
            case 'SSE_DEL':
              symbol = 'D';
            break;
            case 'SSE_INS':
              symbol = 'I';
            break;
            case 'AMPL_LEFT':
              symbol = 'L';
            break;
            case 'AMPL_RIGHT':
              symbol = 'R';
            break;
            case 'LHP':
              symbol = 'H';
          }
          ctx.fillRect(x - 0.5, y - 0.5, width, style.VARIANT_HEIGHT);
          ctx.strokeRect(x - 0.5, y - 0.5, width, style.VARIANT_HEIGHT);
          ctx.fillStyle = style.BLACKLIST_TEXT_COLOR;
          ctx.fillText(symbol, x + 4, y + style.VARIANT_HEIGHT / 2 + 3);
        }
        else {
          // Presumbaly, it is a Tempus black list
          variant.strand = variant.filter;
          if (strand[locus].F && strand[locus].R) {
            // ctx.fillStyle = style.ALIGNMENT_PLUS_STRAND_COLOR;
            ctx.fillStyle = '#ff9999';
            ctx.beginPath();
            ctx.moveTo(x - 0.5, y - 0.5);
            ctx.lineTo(x - 0.5 + width, y - 0.5);
            ctx.lineTo(x - 0.5, y - 0.5 + style.VARIANT_HEIGHT);
            ctx.fill();

            // ctx.fillStyle = style.ALIGNMENT_MINUS_STRAND_COLOR;
            ctx.fillStyle = '#3399ff';
            ctx.beginPath();
            ctx.moveTo(x - 0.5 + width, y - 0.5 + style.VARIANT_HEIGHT);
            ctx.lineTo(x - 0.5 + width, y - 0.5);
            ctx.lineTo(x - 0.5, y - 0.5 + style.VARIANT_HEIGHT);
            ctx.fill();

/*
          ctx.beginPath();
          ctx.moveTo(x - 0.5 + width, y - 0.5);
          ctx.lineTo(x - 0.5, y - 0.5 + style.VARIANT_HEIGHT);
          ctx.stroke();
*/
          }
          else {
            switch (variant.strand) {
              case 'F':
                // ctx.fillStyle = style.ALIGNMENT_PLUS_STRAND_COLOR;
                ctx.fillStyle = '#ff9999';
              break;
              case 'R':
                // ctx.fillStyle = style.ALIGNMENT_MINUS_STRAND_COLOR;
                ctx.fillStyle = '#3399ff';
              break;
              default:
                ctx.fillStyle = 'white';
            }
            ctx.fillRect(x - 0.5, y - 0.5, width, style.VARIANT_HEIGHT);
          }
          ctx.strokeRect(x - 0.5, y - 0.5, width, style.VARIANT_HEIGHT);
        }
      });
      ctx.popObject();
    });

    ctx.restore();
  }

  handleMouseMove(reactEvent: any) {
    var ev = reactEvent.nativeEvent,
        x = ev.offsetX,
        y = ev.offsetY,
        canvas = this.refs.canvas,
        ctx = canvasUtils.getContext(canvas),
        trackingCtx = new dataCanvas.ClickTrackingContext(ctx, x, y);

    this.renderScene(trackingCtx);
    var bl = trackingCtx.hit && trackingCtx.hit[0];
    if (bl) {
      console.log(bl);
      this.refs.popup.open();
      this.refs.popup.domNode.style.left = reactEvent.pageX;
      this.refs.popup.domNode.style.top = reactEvent.pageY;
    }
    else {
      this.refs.popup.close();
    }
  }

  handleMouseLeave(reactEvent: any) {
    this.refs.popup.close();
  }
}

VariantTrack.displayName = 'variants';
BlacklistTrack.displayName = 'blacklist';

module.exports = VariantTrack;
module.exports = BlacklistTrack;

/**
 * Visualization of target regions
 * @flow
 */
/*global clipboardData */
'use strict';

import type {Region, BigBedRegionSource} from '../sources/BigBedRegionDataSource';
import type {VizProps} from '../VisualizationWrapper';
import type {Scale} from './d3utils';

import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'underscore';
import shallowEquals from 'shallow-equals';

import Interval from '../Interval';
import d3utils from './d3utils';
import scale from '../scale';
import ContigInterval from '../ContigInterval';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import style from '../style';


function drawRegionName(
  ctx: CanvasRenderingContext2D,
  clampedScale: (x: number) => number,
  regionLineY: number,
  region: Region,
  textIntervals: Interval[]
) {
  var p = region.position,
      centerX = 0.5 * (clampedScale(1 + p.start()) + clampedScale(1 + p.stop()));
  var name = region.name.split('\t')[0];
  var strand = region.name.split('\t')[2];
  if (strand && strand !== '.') {
    name = strand + name;
  }
  var textWidth = ctx.measureText(name).width;
  var textInterval = new Interval(centerX - 0.5 * textWidth,
                                  centerX + 0.5 * textWidth);
  if (!_.any(textIntervals, iv => textInterval.intersects(iv))) {
    textIntervals.push(textInterval);
    var baselineY = regionLineY + style.GENE_FONT_SIZE + style.GENE_TEXT_PADDING;
    ctx.fillText(name, centerX, baselineY);
  }
}

class RegionTrack extends React.Component {
  props: VizProps & { source: BigBedRegionSource };
  state: {regions: Region[]};

  constructor(props: VizProps) {
    super(props);
    this.state = {
      regions: []
    };
  }

  render(): any {
    return <canvas ref='canvas' onClick={this.handleClick.bind(this)} />;
  }

  componentDidMount() {
    // Visualize new data as it comes in from the network.
    this.props.source.on('newdata', () => {
      var range = this.props.range,
          ci = new ContigInterval(range.contig, range.start, range.stop);
      this.setState({
        regions: this.props.source.getRegionsInRange(ci)
      });
    });

    this.updateVisualization();
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
    var canvas = ReactDOM.findDOMNode(this),
        {width, height} = this.props,
        genomeRange = this.props.range;

    var range = new ContigInterval(genomeRange.contig, genomeRange.start, genomeRange.stop);

    // Hold off until height & width are known.
    if (width === 0) return;

    var sc = this.getScale(),
        // We can't clamp scale directly because of offsetPx.
        clampedScale = scale.linear()
            .domain([sc.invert(0), sc.invert(width)])
            .range([0, width])
            .clamp(true);

    d3utils.sizeCanvas(canvas, width, height);

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var regionLineY = Math.round(height / 4);
    var textIntervals = [];  // x-intervals with rendered region names, to avoid over-drawing.
    // TODO: don't pull in regions via state.
    ctx.font = `${style.GENE_FONT_SIZE}px ${style.GENE_FONT}`;
    ctx.textAlign = 'center';
    var count = 0;
    this.state.regions.forEach(region => {
      var offset;

      if (!region.position.chrIntersects(range)) return;

      count += 1;
      offset = (count % 2) * 2;

      ctx.pushObject(region);
      ctx.lineWidth = 1;
      ctx.strokeStyle = style.GENE_COLOR;
      ctx.fillStyle = style.GENE_COLOR;

      canvasUtils.drawLine(
        ctx,
        clampedScale(1 + region.position.start()), regionLineY + 0.5 + offset,
        clampedScale(1 + region.position.stop()), regionLineY + 0.5 + offset
      );

      if (region.position.start() >= genomeRange.start) {
        canvasUtils.drawLine(
          ctx,
          clampedScale(1 + region.position.start()), regionLineY + 0.5 + offset,
          clampedScale(1 + region.position.start()), regionLineY + 0.5 + offset + (count % 2 ? -4 : 4)
        );
      }

      if (region.position.stop() <= genomeRange.stop) {
        canvasUtils.drawLine(
          ctx,
          clampedScale(1 + region.position.stop()), regionLineY + 0.5 + offset,
          clampedScale(1 + region.position.stop()), regionLineY + 0.5 + offset + (count % 2 ? -4 : 4)
        );
      }

      ctx.strokeStyle = style.GENE_COMPLEMENT_COLOR;
      ctx.lineWidth = 2;

      drawRegionName(ctx, clampedScale, regionLineY, region, textIntervals);
      ctx.popObject();
    });
  }

  copyToClipboard(text) {
    if (window.clipboardData && window.clipboardData.setData) {
      // IE specific code path to prevent textarea being shown while dialog is visible.
      return clipboardData.setData("Text", text);
    }
    else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
      var textarea = document.createElement("textarea");
      textarea.textContent = text;
      textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
      document.body.appendChild(textarea);
      textarea.select();
      try {
        return document.execCommand("copy");  // Security exception may be thrown by some browsers.
      }
      catch (ex) {
        console.warn("Copy to clipboard failed.", ex);
        return false;
      }
      finally {
        document.body.removeChild(textarea);
      }
    }
  }

  handleClick(reactEvent: any) {
    /*
     * Later I should use this sort of code to figure out which of the region tracks
     * was clicked. For now, it will be regions[0]
     *
    var ev = reactEvent.nativeEvent,
        x = ev.offsetX;

    // It's simple to figure out which position was clicked using the x-scale.
    // No need to render the scene to determine what was clicked.
    var range = ContigInterval.fromGenomeRange(this.props.range),
        xScale = this.getScale(),
        pos = Math.floor(xScale.invert(x)) - 1;
    */

    this.copyToClipboard(this.state.regions[0].name);
  }
}

RegionTrack.displayName = 'regions';

module.exports = RegionTrack;

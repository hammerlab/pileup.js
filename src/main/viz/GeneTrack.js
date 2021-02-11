/**
 * Visualization of genes, including exons and coding regions.
 * @flow
 */
'use strict';

import type {Strand} from '../Alignment';
import Gene from '../data/gene';
import type {DataSource} from '../sources/DataSource';
import type {VizProps} from '../VisualizationWrapper';
import type {State} from '../types';

import GenericFeature from '../data/genericFeature';
import {GenericFeatureCache} from './GenericFeatureCache';

import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'underscore';
import shallowEquals from 'shallow-equals';

import bedtools from '../data/bedtools';
import Interval from '../Interval';
import d3utils from './d3utils';
import scale from '../scale';
import ContigInterval from '../ContigInterval';
import canvasUtils from './canvas-utils';
import utils from '../utils';
import dataCanvas from 'data-canvas';
import style from '../style';

// Draw an arrow in the middle of the visible portion of range.
function drawArrow(ctx: CanvasRenderingContext2D,
                   clampedScale: (x: number)=>number,
                   range: Interval,
                   tipY: number,
                   strand: Strand) {
  var x1 = clampedScale(1 + range.start),
      x2 = clampedScale(1 + range.stop);

  // it's off-screen or there's not enough room to draw it legibly.
  if (x2 - x1 <= 2 * style.GENE_ARROW_SIZE) return;

  var cx = (x1 + x2) / 2;
  ctx.beginPath();
  if (strand == '-') {
    ctx.moveTo(cx + style.GENE_ARROW_SIZE, tipY - style.GENE_ARROW_SIZE);
    ctx.lineTo(cx, tipY);
    ctx.lineTo(cx + style.GENE_ARROW_SIZE, tipY + style.GENE_ARROW_SIZE);
  } else {
    ctx.moveTo(cx - style.GENE_ARROW_SIZE, tipY - style.GENE_ARROW_SIZE);
    ctx.lineTo(cx, tipY);
    ctx.lineTo(cx - style.GENE_ARROW_SIZE, tipY + style.GENE_ARROW_SIZE);
  }
  ctx.stroke();
}

function drawGeneName(ctx: CanvasRenderingContext2D,
                      clampedScale: (x: number)=>number,
                      geneLineY: number,
                      gene: Gene,
                      textIntervals: Interval[]) {
  var p = gene.position,
      centerX = 0.5 * (clampedScale(1 + p.start()) + clampedScale(1 + p.stop()));
  // do not use gene name if it is null or empty
  var name =  !_.isEmpty(utils.stringToLiteral(gene.name)) ? gene.name : gene.id;
  var textWidth = ctx.measureText(name).width;
  var textInterval = new Interval(centerX - 0.5 * textWidth,
                                  centerX + 0.5 * textWidth);
  if (!_.any(textIntervals, iv => textInterval.intersects(iv))) {
    textIntervals.push(textInterval);
    var baselineY = geneLineY + style.GENE_FONT_SIZE + style.GENE_TEXT_PADDING;
    ctx.fillText(name, centerX, baselineY);
  }
}

class GeneTrack extends React.Component<VizProps<DataSource<Gene>>, State> {
  props: VizProps<DataSource<Gene>>;
  state: State;
  cache: GenericFeatureCache;

  constructor(props: VizProps<DataSource<Gene>>) {
    super(props);
    this.state = {
      networkStatus: null
    };
  }

  render(): any {
    return <canvas />;
  }

  componentDidMount() {
    this.cache = new GenericFeatureCache(this.props.referenceSource);
      // Visualize new reference data as it comes in from the network.
    this.props.source.on('newdata', (range) => {
      // add genes to generic cache
      var genes = this.props.source.getFeaturesInRange(range);
      genes.forEach(f => this.cache.addFeature(new GenericFeature(f.id, f.position, f)));
      this.updateVisualization();
    });
    this.props.referenceSource.on('newdata', range => {
      this.updateVisualization();
    });
    this.props.source.on('networkprogress', e => {
      this.setState({networkStatus: e});
    });
    this.props.source.on('networkdone', e => {
      this.setState({networkStatus: null});
    });

    this.updateVisualization();
  }

  getScale(): any {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
        !shallowEquals(this.state, prevState)) {
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



    if (canvas && canvas instanceof Element) { // check for getContext
      if (canvas instanceof HTMLCanvasElement) { // check for sizeCanvas
        d3utils.sizeCanvas(canvas, width, height);
      }
      var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));

      ctx.reset();
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      var geneLineY = Math.round(height / 4);
      var textIntervals = [];  // x-intervals with rendered gene names, to avoid over-drawing.
      ctx.font = `${style.GENE_FONT_SIZE}px ${style.GENE_FONT}`;
      ctx.textAlign = 'center';
      var vFeatures = _.flatten(_.map(this.cache.getGroupsOverlapping(range),
                    g => g.items));

      vFeatures.forEach(vFeature => {
        var gene = vFeature.gFeature;
        if (!gene.position.intersects(range)) return;
        ctx.pushObject(gene);
        ctx.lineWidth = 1;
        ctx.strokeStyle = style.GENE_COLOR;
        ctx.fillStyle = style.GENE_COLOR;

        canvasUtils.drawLine(ctx, clampedScale(1 + gene.position.start()), geneLineY + 0.5,
                                  clampedScale(1 + gene.position.stop()), geneLineY + 0.5);

        // TODO: only compute all these intervals when data becomes available.
        var exons = bedtools.splitCodingExons(gene.exons, gene.codingRegion);
        exons.forEach(exon => {
          ctx.fillRect(sc(1 + exon.start),
                       geneLineY - 3 * (exon.isCoding ? 2 : 1),
                       sc(exon.stop + 2) - sc(1 + exon.start),
                       6 * (exon.isCoding ? 2 : 1));
        });

        var introns = gene.position.interval.complementIntervals(gene.exons);
        introns.forEach(range => {
          drawArrow(ctx, clampedScale, range, geneLineY + 0.5, gene.strand);
        });
        ctx.strokeStyle = style.GENE_COMPLEMENT_COLOR;
        ctx.lineWidth = 2;
        gene.exons.forEach(range => {
          drawArrow(ctx, clampedScale, range, geneLineY + 0.5, gene.strand);
        });

        drawGeneName(ctx, clampedScale, geneLineY, gene, textIntervals);

        ctx.popObject();
      });
    } // end typecheck for canvas
  }
}

GeneTrack.displayName = 'genes';

module.exports = GeneTrack;

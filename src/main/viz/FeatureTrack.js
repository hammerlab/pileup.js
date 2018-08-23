/**
 * Visualization of features.
 * @flow
 */
'use strict';

import type {FeatureDataSource} from '../sources/BigBedDataSource';
import GenericFeature from '../data/genericFeature';
import {GenericFeatureCache} from './GenericFeatureCache';
import type {VisualGroup} from './AbstractCache';
import type {DataCanvasRenderingContext2D} from 'data-canvas';

import type {VizProps} from '../VisualizationWrapper';
import type {Scale} from './d3utils';

import React from 'react';
import shallowEquals from 'shallow-equals';
import _ from 'underscore';

import d3utils from './d3utils';
import RemoteRequest from '../RemoteRequest';
import ContigInterval from '../ContigInterval';
import canvasUtils from './canvas-utils';
import TiledCanvas from './TiledCanvas';
import dataCanvas from 'data-canvas';
import style from '../style';
import type {State} from '../types';
import {yForRow} from './pileuputils';


class FeatureTiledCanvas extends TiledCanvas {
  options: Object;
  source: FeatureDataSource;
  cache: GenericFeatureCache;

  constructor(source: FeatureDataSource, cache: GenericFeatureCache, options: Object) {
    super();
    this.source = source;
    this.cache = cache;
    this.options = options;
  }

  update(newOptions: Object) {
    this.options = newOptions;
  }

  heightForRef(ref: string): number {
    return this.cache.pileupHeightForRef(ref) *
                    (style.READ_HEIGHT + style.READ_SPACING);
  }

  render(ctx: DataCanvasRenderingContext2D,
         scale: (x: number)=>number,
         range: ContigInterval<string>,
         originalRange: ?ContigInterval<string>,
         resolution: ?number) {
    var relaxedRange =
        new ContigInterval(range.contig, range.start() - 1, range.stop() + 1);
    // get features and put in cache
    var features = this.source.getFeaturesInRange(relaxedRange, resolution);
    features.forEach(f => this.cache.addFeature(new GenericFeature(f.id, f.position, f)));
    
    // get visual features with assigned rows    
    var vFeatures = this.cache.getGroupsOverlapping(relaxedRange);
    renderFeatures(ctx, scale, relaxedRange, vFeatures);
  }
}

// Draw features
function renderFeatures(ctx: DataCanvasRenderingContext2D,
                    scale: (num: number) => number,
                    range: ContigInterval<string>,
                    vFeatures: VisualGroup<GenericFeature>[]) {

    ctx.font = `${style.GENE_FONT_SIZE}px ${style.GENE_FONT}`;
    ctx.textAlign = 'center';

    vFeatures.forEach(vFeature => {
      var feature = vFeature.items[0].gFeature;
      if (!vFeature.span.intersects(range)) return;
      ctx.pushObject(feature);
      ctx.lineWidth = 1;

      // Create transparency value based on score. Score of <= 200 is the same transparency.
      var alphaScore = Math.max(feature.score / 1000.0, 0.2);
      ctx.fillStyle = 'rgba(0, 0, 0, ' + alphaScore + ')';

      var x = Math.round(scale(vFeature.span.start()));
      var width = Math.ceil(scale(vFeature.span.stop()) - scale(vFeature.span.start()));
      var y = yForRow(vFeature.row);
      ctx.fillRect(x - 0.5, y, width, style.READ_HEIGHT);
      ctx.popObject();
    });
}

class FeatureTrack extends React.Component<VizProps<FeatureDataSource>, State> {
  props: VizProps<FeatureDataSource>;
  state: State;
  tiles: FeatureTiledCanvas;
  cache: GenericFeatureCache;

  constructor(props: VizProps<FeatureDataSource>) {
    super(props);
    this.state = {
      networkStatus: null
    };
  }

  render(): any {
    // These styles allow vertical scrolling to see the full pileup.
    // Adding a vertical scrollbar shrinks the visible area, but we have to act
    // as though it doesn't, since adjusting the scale would put it out of sync
    // with other tracks.
    var containerStyles = {
      'height': '100%'
    };

    var statusEl = null,
        networkStatus = this.state.networkStatus;
    if (networkStatus) {
      statusEl = (
        <div ref='status' className='network-status-small'>
          <div className='network-status-message-small'>
            Loading features…
          </div>
        </div>
      );
    }
    var rangeLength = this.props.range.stop - this.props.range.start;
    // If range is too large, do not render 'canvas'
    if (rangeLength > RemoteRequest.MONSTER_REQUEST) {
       return (
        <div>
            <div className='center'>
              Zoom in to see features
            </div>
            <canvas onClick={this.handleClick.bind(this)} />
          </div>
          );
    } else {
      return (
        <div>
          {statusEl}
          <div ref='container' style={containerStyles}>
            <canvas ref='canvas' onClick={this.handleClick.bind(this)} />
          </div>
        </div>
      );
    }
  }

  componentDidMount() {
    this.cache = new GenericFeatureCache(this.props.referenceSource);
    this.tiles = new FeatureTiledCanvas(this.props.source, this.cache, this.props.options);

    // Visualize new reference data as it comes in from the network.
    this.props.source.on('newdata', (range) => {
      this.tiles.invalidateRange(range);
      this.updateVisualization();
    });
    this.props.referenceSource.on('newdata', range => {
      this.tiles.invalidateRange(range);
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

  getScale(): Scale {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
        !shallowEquals(this.state, prevState)) {
        this.tiles.update(this.props.options);
        this.tiles.invalidateAll();
        this.updateVisualization();
    }
  }

  updateVisualization() {
    var canvas = (this.refs.canvas : HTMLCanvasElement),
        width = this.props.width,
        genomeRange = this.props.range;

    var range = new ContigInterval(genomeRange.contig, genomeRange.start, genomeRange.stop);

    // Hold off until height & width are known.
    if (width === 0 || typeof canvas == 'undefined') return;

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));


    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // get parent of canvas
    // The typecasts through `any` are to fool flow.
    var parent = ((d3utils.findParent(canvas, "features") : any) : HTMLCanvasElement);
    
    // Height can only be computed after the pileup has been updated.
    var height = yForRow(this.cache.pileupHeightForRef(this.props.range.contig));

    // resize height for device
    height = d3utils.heightForCanvas(canvas, height);

    // set height for parent div to include all features
    if (parent) parent.style.height = `${height}px`;

    d3utils.sizeCanvas(canvas, width, height);  

    this.tiles.renderToScreen(ctx, range, this.getScale());
  }

  handleClick(reactEvent: any) {
    var ratio = window.devicePixelRatio;
    var ev = reactEvent.nativeEvent,
        x = ev.offsetX, // resize offset to canvas size
        y = ev.offsetY/ratio;

    var ctx = canvasUtils.getContext(this.refs.canvas);
    var trackingCtx = new dataCanvas.ClickTrackingContext(ctx, x, y);

    var genomeRange = this.props.range,
        // allow some buffering so click isn't so sensitive
        range = new ContigInterval(genomeRange.contig, genomeRange.start-1, genomeRange.stop+1),
        scale = this.getScale(),
        vFeatures = this.cache.getGroupsOverlapping(range);

    renderFeatures(trackingCtx, scale, range, vFeatures);
    var feature = _.find(trackingCtx.hits[0], hit => hit);

    if (feature) {
      //user provided function for displaying popup
      if (typeof this.props.options.onFeatureClicked  === "function") {
        this.props.options.onFeatureClicked(feature);
      } else {
        var alert = window.alert || console.log;
        // Construct a JSON object to show the user.
        var messageObject = _.extend(
          {
            'id':     feature.id,
            'range':  `${feature.position.contig}:${feature.position.start()}-${feature.position.stop()}`,
            'score':  feature.score
          });
        alert(JSON.stringify(messageObject, null, '  '));
      }
    }
  }
}

FeatureTrack.displayName = 'features';

module.exports = FeatureTrack;

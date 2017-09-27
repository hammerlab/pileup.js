/**
 * Visualization of features, including exons and coding regions.
 * @flow
 */
'use strict';

import type {FeatureDataSource} from '../sources/BigBedDataSource';
import type Feature from '../data/feature';

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
import utils from '../utils';
import type {State, NetworkStatus} from '../types';

class FeatureTiledCanvas extends TiledCanvas {
  options: Object;
  source: FeatureDataSource;

  constructor(source: FeatureDataSource, options: Object) {
    super();
    this.source = source;
    this.options = options;
  }

  update(newOptions: Object) {
    this.options = newOptions;
  }

  // TODO: can update to handle overlapping features
  heightForRef(ref: string): number {
    return style.VARIANT_HEIGHT;
  }

  render(ctx: DataCanvasRenderingContext2D,
         scale: (x: number)=>number,
         range: ContigInterval<string>,
         originalRange: ?ContigInterval<string>,
         resolution: ?number) {
    var relaxedRange =
        new ContigInterval(range.contig, range.start() - 1, range.stop() + 1);
    var vFeatures = this.source.getFeaturesInRange(relaxedRange, resolution);
    renderFeatures(ctx, scale, relaxedRange, vFeatures);
  }
}

// Draw features
function renderFeatures(ctx: DataCanvasRenderingContext2D,
                    scale: (num: number) => number,
                    range: ContigInterval<string>,
                    features: Feature[]) {

    ctx.font = `${style.GENE_FONT_SIZE}px ${style.GENE_FONT}`;
    ctx.textAlign = 'center';

    features.forEach(feature => {
      var position = new ContigInterval(feature.contig, feature.start, feature.stop);
      if (!position.intersects(range)) return;
      ctx.pushObject(feature);
      ctx.lineWidth = 1;

      // Create transparency value based on score. Score of <= 200 is the same transparency.
      var alphaScore = Math.max(feature.score / 1000.0, 0.2);
      ctx.fillStyle = 'rgba(0, 0, 0, ' + alphaScore + ')';

      var x = Math.round(scale(feature.start));
      var width = Math.ceil(scale(feature.stop) - scale(feature.start));
      ctx.fillRect(x - 0.5, 0, width, style.VARIANT_HEIGHT);
      ctx.popObject();
    });
}

class FeatureTrack extends React.Component {
  props: VizProps & { source: FeatureDataSource };
  state: State;
  tiles: FeatureTiledCanvas;

  constructor(props: VizProps) {
    super(props);
    this.state = {
      networkStatus: null
    };
  }

  render(): any {
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
          <div ref='container'>
            <canvas ref='canvas' onClick={this.handleClick.bind(this)} />
          </div>
        </div>
      );
    }
  }

  componentDidMount() {
    this.tiles = new FeatureTiledCanvas(this.props.source, this.props.options);

    // Visualize new reference data as it comes in from the network.
    this.props.source.on('newdata', (range) => {
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
        {width, height} = this.props,
        genomeRange = this.props.range;

    var range = new ContigInterval(genomeRange.contig, genomeRange.start, genomeRange.stop);

    // Hold off until height & width are known.
    if (width === 0 || typeof canvas == 'undefined') return;
    d3utils.sizeCanvas(canvas, width, height);

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.tiles.renderToScreen(ctx, range, this.getScale());
    ctx.restore();

  }

  handleClick(reactEvent: any) {
    var ev = reactEvent.nativeEvent,
        x = ev.offsetX;

    var genomeRange = this.props.range,
        // allow some buffering so click isn't so sensitive
        range = new ContigInterval(genomeRange.contig, genomeRange.start-1, genomeRange.stop+1),
        scale = this.getScale(),
        // leave padding of 2px to reduce click specificity
        clickStart = Math.floor(scale.invert(x)) - 2,
        clickEnd = clickStart + 2,
        // If click-tracking gets slow, this range could be narrowed to one
        // closer to the click coordinate, rather than the whole visible range.
        vFeatures = this.props.source.getFeaturesInRange(range);
    var feature = _.find(vFeatures, f => utils.tupleRangeOverlaps([[f.start], [f.stop]], [[clickStart], [clickEnd]]));
    var alert = window.alert || console.log;
    if (feature) {
      // Construct a JSON object to show the user.
      var messageObject = _.extend(
        {
          'id': feature.id,
          'range': `${feature.contig}:${feature.start}-${feature.stop}`,
          'score': feature.score
        });
      alert(JSON.stringify(messageObject, null, '  '));
    }
  }
}

FeatureTrack.displayName = 'features';

module.exports = FeatureTrack;

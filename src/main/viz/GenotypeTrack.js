/**
 * Visualization of genotypes
 * @flow
 */
'use strict';

import type {VcfDataSource} from '../sources/VcfDataSource';
import type {VariantContext} from '../data/variant';
import type {DataCanvasRenderingContext2D} from 'data-canvas';
import type {VizProps} from '../VisualizationWrapper';
import type {Scale} from './d3utils';

import React from 'react';
import _ from 'underscore';


import d3utils from './d3utils';
import shallowEquals from 'shallow-equals';
import ContigInterval from '../ContigInterval';
import canvasUtils from './canvas-utils';
import TiledCanvas from './TiledCanvas';
import dataCanvas from 'data-canvas';
import style from '../style';
import utils from '../utils';
import type {State} from '../types';

var MONSTER_REQUEST = 10000;
var LABEL_WIDTH = 100;

class GenotypeTiledCanvas extends TiledCanvas {
  options: Object;
  source: VcfDataSource;
  callSetNames: string[];

  constructor(source: VcfDataSource, callSetNames: string[], options: Object) {
    super();
    this.source = source;
    this.options = options;
    this.callSetNames = callSetNames;
  }

  update(newOptions: Object) {
    this.options = newOptions;
  }

  heightForRef(ref: string): number {
    return yForRow(this.callSetNames.length);
  }

  render(ctx: DataCanvasRenderingContext2D,
         scale: (x: number)=>number,
         range: ContigInterval<string>,
         originalRange: ?ContigInterval<string>) {
    var relaxedRange =
        new ContigInterval(range.contig, range.start() - 1, range.stop() + 1);

    // relaxed range is just for this tile
    var vGenotypes = this.source.getGenotypesInRange(relaxedRange);
    renderGenotypes(ctx, scale, relaxedRange, vGenotypes, this.callSetNames);
  }
}
// Draw genotypes
function renderGenotypes(ctx: DataCanvasRenderingContext2D,
                    scale: (num: number) => number,
                    range: ContigInterval<string>,
                    vcs: VariantContext[],
                    callSetNames: string[]) {
    // draw genotypes
    vcs.forEach(vc => {
        var variant = vc.variant;
        ctx.pushObject(variant);

        var x = Math.round(scale(variant.position));
        var width = Math.max(1, Math.round(scale(variant.position + 1) - scale(variant.position)));
        vc.calls.forEach(call => {
          var y = yForRow(callSetNames.indexOf(call.callSetName));
          ctx.fillStyle = call.genotype.reduce((a, b) => a + b, 0) == 1 ? style.GENOTYPE_FILL_HET : style.GENOTYPE_FILL_HOM;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.fillRect(x - 0.2, y, width, style.GENOTYPE_HEIGHT);
          ctx.strokeRect(x - 0.2, y, width, style.GENOTYPE_HEIGHT);
        });
        ctx.popObject();
    });
}

function yForRow(row) {
  return row * (style.GENOTYPE_HEIGHT + style.GENOTYPE_SPACING);
}

class GenotypeTrack extends React.Component<VizProps<VcfDataSource>, State> {
  props: VizProps<VcfDataSource>;
  state: State;
  tiles: GenotypeTiledCanvas;
  callSetNames: string[];

  constructor(props: Object) {
    super(props);
    this.callSetNames = [];
    this.state = {
      networkStatus: null
    };
    props.source.getCallNames().then(samples => {
      this.callSetNames = samples;
      this.tiles.callSetNames = samples;
      this.tiles.invalidateAll();
      this.updateVisualization();
    });
  }

  render(): any {
    // These styles allow vertical scrolling to see the full pileup.
    // Adding a vertical scrollbar shrinks the visible area, but we have to act
    // as though it doesn't, since adjusting the scale would put it out of sync
    // with other tracks.
    var containerStyles = {
      'height': '100%'
    };

    var labelStyles = {
      'float': 'left',
      'overflow': 'hidden',
      'width:': `${ LABEL_WIDTH }px`
    };

    var canvasStyles = {
      'overflow': 'hidden'
    };

    var statusEl = null,
        networkStatus = this.state.networkStatus;
    if (networkStatus) {
      statusEl = (
        <div ref='status' className='network-status-small'>
          <div className='network-status-message-small'>
            Loading Genotypes…
          </div>
        </div>
      );
    }
    var rangeLength = this.props.range.stop - this.props.range.start;
    // If range is too large, do not render 'canvas'
    if (rangeLength >= MONSTER_REQUEST) {
       return (
        <div>
            <div className='center'>
              Zoom in to see genotypes
            </div>
            <canvas onClick={this.handleClick.bind(this)} />
          </div>
          );
    } else {
      return (
        <div>
          {statusEl}
          <div ref='container' style={containerStyles}>
            <div className="genotypeLabels" style={labelStyles}><canvas ref='labelCanvas' /></div>
            <div className="genotypeRows" style={canvasStyles}><canvas ref='canvas' onClick={this.handleClick.bind(this)} /></div>
          </div>
        </div>
      );
    }
  }

  componentDidMount() {
        this.tiles = new GenotypeTiledCanvas(this.props.source,
        this.callSetNames, this.props.options);

        // Visualize new data as it comes in from the network.
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
    return d3utils.getTrackScale(this.props.range, this.props.width - LABEL_WIDTH);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(prevProps, this.props) ||
        !shallowEquals(prevState, this.state)) {
          this.tiles.update(this.props.options);
          this.tiles.invalidateAll();
          this.updateVisualization();
    }
  }

  // draws genotype lines to visually separate genotype rows
  drawLines(ctx: DataCanvasRenderingContext2D) {
    var width = this.props.width;

    // draw background for each row
    if (this.callSetNames !== null) {
      ctx.font = "9px Arial";
      this.callSetNames.forEach(sampleId => {
        ctx.pushObject(sampleId);
        var y = yForRow(this.callSetNames.indexOf(sampleId));
        ctx.fillStyle = style.BACKGROUND_FILL;
        ctx.fillRect(0, y, width, style.GENOTYPE_HEIGHT);
        ctx.popObject();
      });
    }
  }

  // draws sample names on side bar. This needs to be only rendered once.
  drawLabels() {
    // if already drawn, return
    var labelCanvas = (this.refs.labelCanvas : HTMLCanvasElement),
        width = this.props.width;

    // Hold off until height & width are known.
    if (width === 0 || typeof labelCanvas == 'undefined') return;

    var height = yForRow(this.callSetNames.length);


    // only render once on load.
    if (labelCanvas.clientHeight != height) {
      var labelCtx = dataCanvas.getDataContext(canvasUtils.getContext(labelCanvas));
      d3utils.sizeCanvas(labelCanvas, LABEL_WIDTH, height);

      // draw label for each row
      if (this.callSetNames !== null) {
        labelCtx.font = "9px Arial";
        this.callSetNames.forEach(sampleId => {
          labelCtx.pushObject(sampleId);
          var y = yForRow(this.callSetNames.indexOf(sampleId));
          labelCtx.fillStyle = "black";
          labelCtx.fillText(sampleId, 0, y+style.GENOTYPE_HEIGHT);
          labelCtx.popObject();
        });
      }
    }
  }

  updateVisualization() {
    var canvas = (this.refs.canvas : HTMLCanvasElement),
        width = this.props.width;

    // Hold off until height & width are known.
    if (width === 0 || typeof canvas == 'undefined') return;

    var height = yForRow(this.callSetNames.length);
    d3utils.sizeCanvas(canvas, width - LABEL_WIDTH, height);

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));
    this.drawLabels();
    this.renderScene(ctx);
  }

  renderScene(ctx: DataCanvasRenderingContext2D) {
    var range = this.props.range,
        interval = new ContigInterval(range.contig, range.start, range.stop),
        scale = this.getScale();

    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // render lines after rectangle has been cleared
    this.drawLines(ctx);

    this.tiles.renderToScreen(ctx, interval, scale);
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
        vGenotypes = this.props.source.getGenotypesInRange(range);

    var genotype = _.find(vGenotypes, f => utils.tupleRangeOverlaps([[f.variant.position], [f.variant.position+1]], [[clickStart], [clickEnd]]));
    var alert = window.alert || console.log;
    if (genotype) {
      var variantString = `variant: ${JSON.stringify(genotype.variant)}`;
      var callSetNames = genotype.calls.map(r => r.callSetName);
      var samples = `samples with variant: ${JSON.stringify(callSetNames)}`;
      alert(`${variantString}\n${samples}`);
    }
  }
}

GenotypeTrack.displayName = 'genotypes';

module.exports = GenotypeTrack;

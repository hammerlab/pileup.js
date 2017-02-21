/**
 * A track which displays a reference genome.
 * @flow
 */
'use strict';

import type {VizProps} from '../VisualizationWrapper';
import type {TwoBitSource} from '../sources/TwoBitDataSource';
import type {DataCanvasRenderingContext2D} from 'data-canvas';
import type {Scale} from './d3utils';

import React from 'react';
import ReactDOM from 'react-dom';
import shallowEquals from 'shallow-equals';

import canvasUtils from './canvas-utils';
import ContigInterval from '../ContigInterval';
import dataCanvas from 'data-canvas';
import d3utils from './d3utils';
import DisplayMode from './DisplayMode';
import TiledCanvas from './TiledCanvas';
import style from '../style';


function renderGenome(ctx: DataCanvasRenderingContext2D,
                      scale: (num: number) => number,
                      height: number,
                      range: ContigInterval<string>,
                      basePairs: string) {
  var pxPerLetter = scale(1) - scale(0);
  var mode = DisplayMode.getDisplayMode(pxPerLetter);
  var showText = DisplayMode.isText(mode);

  if (mode != DisplayMode.HIDDEN) {
    ctx.textAlign = 'center';
    if (mode == DisplayMode.LOOSE) {
      ctx.font = style.LOOSE_TEXT_STYLE;
    } else if (mode == DisplayMode.TIGHT) {
      ctx.font = style.TIGHT_TEXT_STYLE;
    }

    var previousBase = null;
    var start = range.start(),
        stop = range.stop();
    for (var pos = start; pos <= stop; pos++) {
      var letter = basePairs[pos - start];
      if (letter == '.') continue;  // not yet known

      ctx.save();
      ctx.pushObject({pos, letter});
      ctx.fillStyle = style.BASE_COLORS[letter];
      if (showText) {
        // We only push objects in the text case as it involves creating a
        // new object & can become a performance issue.
        // 0.5 = centered
        ctx.fillText(letter, scale(1 + 0.5 + pos), height - 1);
      } else {
        if (pxPerLetter >= style.COVERAGE_MIN_BAR_WIDTH_FOR_GAP) {
          // We want a white space between blocks at this size, so we can see
          // the difference between bases.
          ctx.fillRect(scale(1 + pos) + 0.5, 0,  pxPerLetter - 1.5, height);
        } else if (previousBase === letter) {
          // Otherwise, we want runs of colors to be completely solid ...
          ctx.fillRect(scale(1 + pos) - 1.5, 0, pxPerLetter + 1.5, height);
        } else {
          // ... and minimize the amount of smudging and whitespace between
          // bases.
          ctx.fillRect(scale(1 + pos) - 0.5, 0,  pxPerLetter + 1.5, height);
        }
      }

      ctx.popObject();
      ctx.restore();
      previousBase = letter;
    }
  }
}


class GenomeTiledCanvas extends TiledCanvas {
  source: TwoBitSource;
  height: number;

  constructor(source: TwoBitSource, height: number) {
    super();
    this.source = source;
    // workaround for an issue in PhantomJS where height always comes out to zero.
    this.height = Math.max(1, height);
  }

  render(ctx: DataCanvasRenderingContext2D,
         scale: (x: number)=>number,
         range: ContigInterval<string>) {
    // The +/-1 ensures that partially-visible bases on the edge are rendered.
    var genomeRange = {
      contig: range.contig,
      start: Math.max(0, range.start() - 1),
      stop: range.stop() + 1
    };
    var basePairs = this.source.getRangeAsString(genomeRange);
    renderGenome(ctx, scale, this.height, ContigInterval.fromGenomeRange(genomeRange), basePairs);
  }

  heightForRef(ref: string): number {
    return this.height;
  }

  updateHeight(height: number) {
    this.height = height;
  }
}


class GenomeTrack extends React.Component {
  props: VizProps & {source: TwoBitSource};
  state: void;  // no state
  tiles: GenomeTiledCanvas;

  render(): any {
    return <canvas />;
  }

  componentDidMount() {
    this.tiles = new GenomeTiledCanvas(this.props.source, this.props.height);

    // Visualize new reference data as it comes in from the network.
    this.props.source.on('newdata', range => {
      this.tiles.invalidateRange(range);
      this.updateVisualization();
    });

    this.updateVisualization();
  }

  getScale(): Scale {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(prevProps, this.props) ||
        !shallowEquals(prevState, this.state)) {
      if (this.props.height != prevProps.height) {
        this.tiles.updateHeight(this.props.height);
        this.tiles.invalidateAll();
      }
      this.updateVisualization();
    }
  }

  updateVisualization() {
    var canvas = ReactDOM.findDOMNode(this),
        {width, height, range} = this.props;

    // Hold off until height & width are known.
    if (width === 0) return;
    d3utils.sizeCanvas(canvas, width, height);

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.tiles.renderToScreen(ctx, ContigInterval.fromGenomeRange(range), this.getScale());
  }
}

GenomeTrack.displayName = 'reference';

module.exports = GenomeTrack;

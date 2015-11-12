/**
 * A track which displays a reference genome.
 * @flow
 */
'use strict';

import type {VizProps} from './VisualizationWrapper';
import type {TwoBitSource} from './TwoBitDataSource';
import type {DataCanvasRenderingContext2D} from 'data-canvas';

var React = require('react'),
    ReactDOM = require('react-dom'),
    shallowEquals = require('shallow-equals');

var canvasUtils = require('./canvas-utils'),
    ContigInterval = require('./ContigInterval'),
    dataCanvas = require('data-canvas'),
    d3utils = require('./d3utils'),
    DisplayMode = require('./DisplayMode'),
    style = require('./style');


function renderGenome(ctx: DataCanvasRenderingContext2D,
                      scale: (num: number) => number,
                      range: ContigInterval<string>,
                      basePairs: string) {
  var pxPerLetter = scale(1) - scale(0);
  var mode = DisplayMode.getDisplayMode(pxPerLetter);
  var showText = DisplayMode.isText(mode);
  var height = ctx.canvas.height;

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


class GenomeTrack extends React.Component {
  props: VizProps & {source: TwoBitSource};
  state: void;  // no state

  render(): any {
    return <canvas />;
  }

  componentDidMount() {
    // Visualize new reference data as it comes in from the network.
    this.props.source.on('newdata', () => {
      this.updateVisualization();
    });

    this.updateVisualization();
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
        {width, height, range} = this.props,
    // The +/-1 ensures that partially-visible bases on the edge are rendered.
    interval = new ContigInterval(range.contig, range.start - 1, range.stop + 1);
    console.log(interval.toString());

    // Hold off until height & width are known.
    if (width === 0) return;
    d3utils.sizeCanvas(canvas, width, height);

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    renderGenome(ctx, this.getScale(), interval,
                 this.props.source.getRangeAsString(interval.toGenomeRange()));

  }
}

GenomeTrack.displayName = 'reference';

module.exports = GenomeTrack;

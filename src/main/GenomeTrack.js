/**
 * A track which displays a reference genome.
 * @flow
 */
'use strict';

import type {VizProps} from './VisualizationWrapper';
import type {TwoBitSource} from './TwoBitDataSource';

var React = require('react'),
    ReactDOM = require('react-dom');

var shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    canvasUtils = require('./canvas-utils'),
    dataCanvas = require('data-canvas'),
    d3utils = require('./d3utils'),
    DisplayMode = require('./DisplayMode'),
    style = require('./style');


class GenomeTrack extends (React.Component : typeof ReactComponent) {
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
        {width, height, range} = this.props;

    // Hold off until height & width are known.
    if (width === 0) return;
    d3utils.sizeCanvas(canvas, width, height);

    var scale = this.getScale();
    var pxPerLetter = scale(1) - scale(0);
    var mode = DisplayMode.getDisplayMode(pxPerLetter);
    var showText = DisplayMode.isText(mode);

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (mode != DisplayMode.HIDDEN) {
      var basePairs = this.props.source.getRange({
        contig: range.contig,
        start: Math.max(0, range.start - 1),
        stop: range.stop
      });

      ctx.textAlign = 'center';
      if (mode == DisplayMode.LOOSE) {
        ctx.font = style.LOOSE_TEXT_STYLE;
      } else if (mode == DisplayMode.TIGHT) {
        ctx.font = style.TIGHT_TEXT_STYLE;
      }

      var contigColon = this.props.range.contig + ':';
      var previousBase = null;
      for (var pos = range.start - 1; pos <= range.stop; pos++) {
        var letter = basePairs[contigColon + pos];

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
}

GenomeTrack.displayName = 'reference';

module.exports = GenomeTrack;

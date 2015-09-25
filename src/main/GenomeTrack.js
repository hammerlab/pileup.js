
/**
 * A track which displays a reference genome.
 * @flow
 */
'use strict';

var React = require('./react-shim'),
    _ = require('underscore'),
    d3 = require('d3'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    utils = require('./utils'),
    dataCanvas = require('./data-canvas'),
    d3utils = require('./d3utils'),
    DisplayMode = require('./DisplayMode'),
    style = require('./style');


var GenomeTrack = React.createClass({
  // This prevents updates if state & props have not changed.
  mixins: [React.addons.PureRenderMixin],
  displayName: 'reference',

  propTypes: {
    range: types.GenomeRange.isRequired,
    source: React.PropTypes.object.isRequired,
    onRangeChange: React.PropTypes.func.isRequired,
  },
  render: function(): any {
    return <div><canvas ref='canvas' /></div>;
  },
  componentDidMount: function() {
    var div = this.getDOMNode();

    // Visualize new reference data as it comes in from the network.
    this.props.source.on('newdata', () => {
      this.updateVisualization();
    });


    this.updateVisualization();
  },
  getScale: function() {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  },
  componentDidUpdate: function(prevProps: any, prevState: any) {
    if (!shallowEquals(prevProps, this.props) ||
        !shallowEquals(prevState, this.state)) {
      this.updateVisualization();
    }
  },

  getCanvasContext(): CanvasRenderingContext2D {
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement);
    // The typecast through `any` is because getContext could return a WebGL context.
    var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
    return ctx;
  },

  updateVisualization: function() {
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement),
        width = this.props.width,
        height = this.props.height,
        range = this.props.range;

    // Hold off until height & width are known.
    if (width === 0) return;
    d3.select(canvas).attr({width, height});

    var scale = this.getScale();
    var pxPerLetter = scale(1) - scale(0);
    var mode = DisplayMode.getDisplayMode(pxPerLetter);
    var showText = DisplayMode.isText(mode);

    var ctx = dataCanvas.getDataContext(this.getCanvasContext());
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
          ctx.fillText(letter, scale(1 + 0.5 + pos), height - 2);
        } else {
          if (pxPerLetter >= 5) {
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
});

module.exports = GenomeTrack;

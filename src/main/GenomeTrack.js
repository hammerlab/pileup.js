/**
 * A track which displays a reference genome.
 * @flow
 */
'use strict';

var React = require('./react-shim'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    canvasUtils = require('./canvas-utils'),
    dataCanvas = require('data-canvas'),
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
  },
  render: function(): any {
    return <canvas />;
  },
  componentDidMount: function() {
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

  updateVisualization: function() {
    var canvas = this.getDOMNode(),
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
          ctx.fillRect(scale(1 + pos), 0,  pxPerLetter - 1, height);
        }
        ctx.popObject();
        ctx.restore();
      }
    }
  }
});

module.exports = GenomeTrack;

/**
 * A track which shows a scale proportional to slice of the genome being
 * shown by the reference track. This track tries to show a scale in kbp,
 * mbp or gbp depending on the size of the view and also tries to round the
 * scale size (e.g. prefers "1,000 bp", "1,000 kbp" over "1 kbp" and "1 mbp")
 *
 *           ---------- 30 chars ----------
 *
 * @flow
 */
'use strict';

var React = require('./react-shim'),
    d3 = require('d3'),
    EmptySource = require('./EmptySource'),
    types = require('./react-types'),
    utils = require('./utils'),
    dataCanvas = require('./data-canvas'),
    style = require('./style'),
    d3utils = require('./d3utils');

class ScaleTrack extends React.Component {
  constructor(props: Object) {
    super(props);
    this.state = {
      labelSize: {height: 0, width: 0}
    };
  }

  getScale() {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  render(): any {
    return <canvas ref='canvas' />;
  }

  componentDidMount() {
    this.updateVisualization();
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    this.updateVisualization();
  }

  getDOMNode(): any {
    return React.findDOMNode(this);
  }

  getContext(): CanvasRenderingContext2D {
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement);
    // The typecast through `any` is because getContext could return a WebGL context.
    var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
    return ctx;
  }

  updateVisualization() {
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement),
        range = this.props.range,
        width = this.props.width,
        height = this.props.height;

    d3.select(canvas).attr({width, height});

    var ctx = dataCanvas.getDataContext(this.getContext());
    ctx.save();
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var viewSize = range.stop - range.start + 1,
        midX = width / 2,
        midY = height / 2;

    // Mid label
    var {prefix, unit} = d3utils.formatRange(viewSize);
    ctx.lineWidth = 1;
    ctx.fillStyle = style.SCALE_FONT_COLOR;
    ctx.font = style.SCALE_FONT_STYLE;
    ctx.textAlign = "center";
    ctx.fillText(prefix + " " + unit,
                 midX,
                 midY + style.SCALE_TEXT_Y_OFFSET);

    // Left line
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(midX - style.SCALE_LINE_PADDING, midY);
    ctx.stroke();
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(0 + style.SCALE_ARROW_SIZE, midY - style.SCALE_ARROW_SIZE);
    ctx.lineTo(0, midY);
    ctx.lineTo(0 + style.SCALE_ARROW_SIZE, midY + style.SCALE_ARROW_SIZE);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(midX + style.SCALE_LINE_PADDING, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(width - style.SCALE_ARROW_SIZE, midY - style.SCALE_ARROW_SIZE);
    ctx.lineTo(width, midY);
    ctx.lineTo(width - style.SCALE_ARROW_SIZE, midY + style.SCALE_ARROW_SIZE);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Clean up afterwards
    ctx.restore();
  }
}

ScaleTrack.propTypes = {
  range: types.GenomeRange.isRequired,
  onRangeChange: React.PropTypes.func.isRequired,
};
ScaleTrack.displayName = 'scale';
ScaleTrack.defaultSource = EmptySource.create();

module.exports = ScaleTrack;

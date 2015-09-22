/**
 * Pileup visualization of BAM sources.
 * @flow
 */
'use strict';

import type {Strand, Alignment, AlignmentDataSource} from './Alignment';
import type {TwoBitSource} from './TwoBitDataSource';
import type {BasePair} from './pileuputils';
import type {VisualAlignment, VisualGroup} from './PileupCache';

var React = require('./react-shim'),
    d3 = require('d3'),
    _ = require('underscore'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    utils = require('./utils'),
    d3utils = require('./d3utils'),
    {addToPileup, getOpInfo, CigarOp} = require('./pileuputils'),
    ContigInterval = require('./ContigInterval'),
    Interval = require('./Interval'),
    DisplayMode = require('./DisplayMode'),
    PileupCache = require('./PileupCache'),
    dataCanvas = require('./data-canvas');


var READ_HEIGHT = 13;
var READ_SPACING = 2;  // vertical pixels between reads

var READ_STRAND_ARROW_WIDTH = 6;



// Should the Cigar op be rendered to the screen?
function isRendered(op) {
  return (op.op == CigarOp.MATCH ||
          op.op == CigarOp.DELETE ||
          op.op == CigarOp.INSERT);
}

// The renderer pulls out the canvas context and scale into shared variables in a closure.
function getRenderer(ctx: DataCanvasRenderingContext2D, scale: (num: number) => number) {
  function drawArrow(pos: number, refLength: number, top: number, direction: 'L' | 'R') {
    var left = scale(pos + 1),
        right = scale(pos + refLength + 1),
        bottom = top + READ_HEIGHT;

    ctx.beginPath();
    if (direction == 'R') {
      ctx.moveTo(left, top);
      ctx.lineTo(right - READ_STRAND_ARROW_WIDTH, top);
      ctx.lineTo(right, (top + bottom) / 2);
      ctx.lineTo(right - READ_STRAND_ARROW_WIDTH, bottom);
      ctx.lineTo(left, bottom);
    } else {
      ctx.moveTo(right, top);
      ctx.lineTo(left + READ_STRAND_ARROW_WIDTH, top);
      ctx.lineTo(left, (top + bottom) / 2);
      ctx.lineTo(left + READ_STRAND_ARROW_WIDTH, bottom);
      ctx.lineTo(right, bottom);
    }
    ctx.fill();
  }

  function drawSegment(op, y) {
    switch (op.op) {
      case CigarOp.MATCH:
        if (op.arrow) {
          drawArrow(op.pos, op.length, y, op.arrow);
        } else {
          var x = scale(op.pos + 1);
          ctx.fillRect(x, y, scale(op.pos + op.length + 1) - x, READ_HEIGHT);
        }
        break;

      case CigarOp.DELETE:
        var x1 = scale(op.pos + 1),
            x2 = scale(op.pos + 1 + op.length),
            yp = y + READ_HEIGHT / 2 - 0.5;
        ctx.save();
        ctx.fillStyle = 'black';
        ctx.fillRect(x1, yp, x2 - x1, 1);
        ctx.restore();
        break;

      case CigarOp.INSERT:
        ctx.save();
        ctx.fillStyle = 'rgb(97, 0, 216)';
        var x = scale(op.pos + 1) - 2,  // to cover a bit of the previous segment
            y1 = y - 1,
            y2 = y + READ_HEIGHT + 2;
        ctx.fillRect(x, y1, 1, y2 - y1);
        ctx.restore();
        break;
    }
  }

  function drawAlignment(vRead: VisualAlignment, y: number) {
    ctx.pushObject(vRead);
    vRead.ops.forEach(op => {
      if (isRendered(op)) {
        drawSegment(op, y);
      }
    });
    vRead.mismatches.forEach(bp => renderMismatch(bp, y));
    ctx.popObject();
  }

  function drawGroup(vGroup: VisualGroup) {
    ctx.pushObject(vGroup);
    var y = yForRow(vGroup.row);
    vGroup.alignments.forEach(vRead => drawAlignment(vRead, y));
    if (vGroup.insert) {
      var span = vGroup.insert,
          x1 = scale(span.start + 1),
          x2 = scale(span.stop + 1);
      ctx.fillRect(x1, y + READ_HEIGHT / 2 - 0.5, x2 - x1, 1);
    }
    ctx.popObject();
  }

  function renderMismatch(bp: BasePair, y: number) {
    ctx.pushObject(bp);
    ctx.save();
    ctx.fillStyle = BASE_COLORS[bp.basePair];
    ctx.globalAlpha = opacityForQuality(bp.quality);
    ctx.fillText(bp.basePair, scale(bp.pos), y + READ_HEIGHT - 2);
    ctx.restore();
    ctx.popObject();
  }

  return {drawArrow, drawSegment, drawGroup}
}


function yForRow(row) {
  return row * (READ_HEIGHT + READ_SPACING);
}

// This is adapted from IGV.
var MIN_Q = 5,  // these are Phred-scaled scores
    MAX_Q = 20,
    Q_SCALE = d3.scale.linear()
                .domain([MIN_Q, MAX_Q])
                .range([0.1, 0.9])
                .clamp(true);  // clamp output to [0.1, 0.9]
function opacityForQuality(quality: number): number {
  var alpha = Q_SCALE(quality);

  // Round alpha to nearest 0.1
  alpha = Math.round(alpha * 10 + 0.5) / 10.0;
  return Math.min(1.0, alpha);
}

var BASE_COLORS = {
  'A': '#188712',
  'G': '#C45C16',
  'C': '#0600F9',
  'T': '#F70016',
  'U': '#F70016',
  'N': 'black'
};

class PileupTrack extends React.Component {
  cache: PileupCache;

  constructor(props: Object) {
    super(props);
    this.state = {
      reads: []
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
      var message = this.formatStatus(networkStatus);
      statusEl = (
        <div ref='status' className='network-status'>
          <div className='network-status-message'>
            Loading alignments… ({message})
          </div>
        </div>
      );
    }

    return (
      <div>
        {statusEl}
        <div ref='container' style={containerStyles}>
          <canvas ref='canvas' onClick={this.handleClick.bind(this)} />
        </div>
      </div>
    );
  }

  formatStatus(state: Object): string {
    if (state.numRequests) {
      var pluralS = state.numRequests > 1 ? 's' : '';
      return `issued ${state.numRequests} request${pluralS}`;
    } else if (state.status) {
      return state.status;
    }
    throw 'invalid';
  }

  componentDidMount() {
    this.cache = new PileupCache(this.props.referenceSource);
    this.props.source.on('newdata', range => {
      this.updateReads(range);
      this.updateVisualization();
    });
    this.props.referenceSource.on('newdata', range => {
      this.cache.updateMismatches(range);
      this.updateVisualization();
    });
    this.props.source.on('networkprogress', e => {
      this.setState({networkStatus: e});
    }).on('networkdone', e => {
      this.setState({networkStatus: null});
    });

    this.updateVisualization();
  }

  getScale() {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
        !shallowEquals(this.state, prevState)) {
      this.updateVisualization();
    }
  }

  // Load new reads into the visualization cache.
  updateReads(range: ContigInterval<string>) {
    var source = (this.props.source : AlignmentDataSource);
    source.getAlignmentsInRange(range)
          .forEach(read => this.cache.addAlignment(read));
  }

  getCanvasContext(): CanvasRenderingContext2D {
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement);
    // The typecast through `any` is because getContext could return a WebGL context.
    var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
    return ctx;
  }

  // Update the D3 visualization to reflect the cached reads &
  // currently-visible range.
  updateVisualization() {
    var canvas = (this.refs.canvas.getDOMNode() : HTMLCanvasElement),
        width = this.props.width;

    // Hold off until height & width are known.
    if (width === 0) return;

    // Height can only be computed after the pileup has been updated.
    var height = yForRow(this.cache.pileupHeightForRef(this.props.range.contig));

    d3.select(canvas).attr({width, height});

    var ctx = this.getCanvasContext();
    var dtx = dataCanvas.getDataContext(ctx);
    this.renderScene(dtx);
  }

  renderScene(ctx: DataCanvasRenderingContext2D) {
    var genomeRange = this.props.range,
        range = new ContigInterval(genomeRange.contig, genomeRange.start, genomeRange.stop);
    var vGroups = this.cache.getGroupsOverlapping(range);

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#c8c8c8';

    var scale = this.getScale();
    var renderer = getRenderer(ctx, scale);
    vGroups.forEach(vGroup => renderer.drawGroup(vGroup));
  }

  handleClick(reactEvent: any) {
    var ev = reactEvent.nativeEvent,
        x = ev.offsetX,
        y = ev.offsetY;
    var ctx = this.getCanvasContext();
    var trackingCtx = new dataCanvas.ClickTrackingContext(ctx, x, y);
    this.renderScene(trackingCtx);
    var vRead = trackingCtx.hit && trackingCtx.hit[0];
    if (vRead) {
      alert(vRead.read.debugString());
    }
  }
}

PileupTrack.propTypes = {
  range: types.GenomeRange.isRequired,
  source: React.PropTypes.object.isRequired,
  referenceSource: React.PropTypes.object.isRequired,
  onRangeChange: React.PropTypes.func.isRequired
};
PileupTrack.displayName = 'pileup';


module.exports = PileupTrack;

/**
 * Pileup visualization of BAM sources.
 * @flow
 */
'use strict';

import type {Strand, Alignment, AlignmentDataSource} from './Alignment';
import type {TwoBitSource} from './TwoBitDataSource';
import type {BasePair} from './pileuputils';
import type {VisualAlignment, VisualGroup} from './PileupCache';
import type {DataCanvasRenderingContext2D} from 'data-canvas';
import type * as Interval from './Interval';
import type {VizProps} from './VisualizationWrapper';

var React = require('react'),
    shallowEquals = require('shallow-equals'),
    _ = require('underscore');

var scale = require('./scale'),
    d3utils = require('./d3utils'),
    {CigarOp} = require('./pileuputils'),
    ContigInterval = require('./ContigInterval'),
    DisplayMode = require('./DisplayMode'),
    PileupCache = require('./PileupCache'),
    TiledCanvas = require('./TiledCanvas'),
    canvasUtils = require('./canvas-utils'),
    dataCanvas = require('data-canvas'),
    style = require('./style');


var READ_HEIGHT = 13;
var READ_SPACING = 2;  // vertical pixels between reads

var READ_STRAND_ARROW_WIDTH = 6;

// PhantomJS does not support setLineDash.
// Node doesn't even know about the symbol.
var SUPPORTS_DASHES = typeof(CanvasRenderingContext2D) !== 'undefined' &&
                      !!CanvasRenderingContext2D.prototype.setLineDash;

class PileupTileCache extends TiledCanvas {
  cache: PileupCache;

  constructor(cache: PileupCache) {
    super();
    this.cache = cache;
  }

  heightForRef(ref: string): number {
    return this.cache.pileupHeightForRef(ref) *
                    (READ_HEIGHT + READ_SPACING);
  }

  render(ctx: DataCanvasRenderingContext2D,
         scale: (x: number)=>number,
         range: ContigInterval<string>) {
    var vGroups = this.cache.getGroupsOverlapping(range);
    renderPileup(ctx, scale, range, vGroups);
  }
}


// Should the Cigar op be rendered to the screen?
function isRendered(op) {
  return (op.op == CigarOp.MATCH ||
          op.op == CigarOp.DELETE ||
          op.op == CigarOp.INSERT);
}

// Render a portion of the pileup into the canvas.
function renderPileup(ctx: DataCanvasRenderingContext2D,
                      scale: (num: number) => number,
                      range: ContigInterval<string>,
                      vGroups: VisualGroup[]) {
  // Should mismatched base pairs be shown as blocks of color or as letters?
  var pxPerLetter = scale(1) - scale(0),
      mode = DisplayMode.getDisplayMode(pxPerLetter),
      showText = DisplayMode.isText(mode);

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
        ctx.fillStyle = style.DELETE_COLOR;
        ctx.fillRect(x1, yp, x2 - x1, 1);
        ctx.restore();
        break;

      case CigarOp.INSERT:
        ctx.save();
        ctx.fillStyle = style.INSERT_COLOR;
        var x0 = scale(op.pos + 1) - 2,  // to cover a bit of the previous segment
            y1 = y - 1,
            y2 = y + READ_HEIGHT + 2;
        ctx.fillRect(x0, y1, 1, y2 - y1);
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
    var y = yForRow(vGroup.row);
    ctx.pushObject(vGroup);
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
    // This can happen if the mismatch is in a different tile, for example.
    if (!range.interval.contains(bp.pos)) return;

    ctx.pushObject(bp);
    ctx.save();
    ctx.fillStyle = style.BASE_COLORS[bp.basePair];
    ctx.globalAlpha = opacityForQuality(bp.quality);
    ctx.textAlign = 'center';
    if (showText) {
      // 0.5 = centered
      ctx.fillText(bp.basePair, scale(1 + 0.5 + bp.pos), y + READ_HEIGHT - 2);
    } else {
      ctx.fillRect(scale(1 + bp.pos), y,  pxPerLetter - 1, READ_HEIGHT);
    }
    ctx.restore();
    ctx.popObject();
  }

  ctx.fillStyle = style.ALIGNMENT_COLOR;
  ctx.font = style.TIGHT_TEXT_STYLE;
  vGroups.forEach(vGroup => drawGroup(vGroup));
}


function yForRow(row) {
  return row * (READ_HEIGHT + READ_SPACING);
}

// This is adapted from IGV.
var MIN_Q = 5,  // these are Phred-scaled scores
    MAX_Q = 20,
    Q_SCALE = scale.linear()
                   .domain([MIN_Q, MAX_Q])
                   .range([0.1, 0.9])
                   .clamp(true);  // clamp output to [0.1, 0.9]
function opacityForQuality(quality: number): number {
  var alpha = Q_SCALE(quality);

  // Round alpha to nearest 0.1
  alpha = Math.round(alpha * 10 + 0.5) / 10.0;
  return Math.min(1.0, alpha);
}

type NetworkStatus = {numRequests?: number, status?: string};
type State = {
  networkStatus: ?NetworkStatus;
};


class PileupTrack extends React.Component {
  props: VizProps & { source: AlignmentDataSource };
  state: State;
  cache: PileupCache;
  tiles: TiledCanvas;
  static defaultOptions: { viewAsPairs: boolean };

  constructor(props: VizProps) {
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

  formatStatus(status: NetworkStatus): string {
    if (status.numRequests) {
      var pluralS = status.numRequests > 1 ? 's' : '';
      return `issued ${status.numRequests} request${pluralS}`;
    } else if (status.status) {
      return status.status;
    }
    throw 'invalid';
  }

  componentDidMount() {
    this.cache = new PileupCache(this.props.referenceSource, this.props.options.viewAsPairs);
    this.tiles = new PileupTileCache(this.cache);

    this.props.source.on('newdata', range => {
      this.updateReads(range);
      // TODO: only invalidate tiles in the range
      this.tiles.invalidateAll();
      this.updateVisualization();
    });
    this.props.referenceSource.on('newdata', range => {
      this.cache.updateMismatches(range);
      // TODO: only invalidate tiles in the range
      this.tiles.invalidateAll();
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

  // Update the visualization to reflect the cached reads &
  // currently-visible range.
  updateVisualization() {
    var canvas = this.refs.canvas,
        width = this.props.width;

    // Hold off until height & width are known.
    if (width === 0) return;

    // Height can only be computed after the pileup has been updated.
    var height = yForRow(this.cache.pileupHeightForRef(this.props.range.contig));

    d3utils.sizeCanvas(canvas, width, height);

    var ctx = canvasUtils.getContext(canvas);
    var dtx = dataCanvas.getDataContext(ctx);
    this.renderScene(dtx);
  }

  renderScene(ctx: DataCanvasRenderingContext2D) {
    var genomeRange = this.props.range,
        range = new ContigInterval(genomeRange.contig, genomeRange.start, genomeRange.stop),
        scale = this.getScale();

    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.tiles.renderToScreen(ctx, range, scale);

    // TODO: the center line should go above alignments, but below mismatches
    this.renderCenterLine(ctx, range, scale);
  }

  // Draw the center line(s), which orient the user
  renderCenterLine(ctx: CanvasRenderingContext2D,
                   range: ContigInterval<string>,
                   scale: (num: number) => number) {
    var midPoint = Math.floor((range.stop() + range.start()) / 2),
        rightLineX = Math.ceil(scale(midPoint + 1)),
        leftLineX = Math.floor(scale(midPoint)),
        height = ctx.canvas.height;
    ctx.save();
    ctx.lineWidth = 1;
    if (SUPPORTS_DASHES) {
      ctx.setLineDash([5, 5]);
    }
    if (rightLineX - leftLineX < 3) {
      // If the lines are very close, then just draw a center line.
      var midX = Math.round((leftLineX + rightLineX) / 2);
      canvasUtils.drawLine(ctx, midX - 0.5, 0, midX - 0.5, height);
    } else {
      canvasUtils.drawLine(ctx, leftLineX - 0.5, 0, leftLineX - 0.5, height);
      canvasUtils.drawLine(ctx, rightLineX - 0.5, 0, rightLineX - 0.5, height);
    }
    ctx.restore();
  }

  handleClick(reactEvent: any) {
    var ev = reactEvent.nativeEvent,
        x = ev.offsetX,
        y = ev.offsetY;
    var ctx = canvasUtils.getContext(this.refs.canvas);
    var trackingCtx = new dataCanvas.ClickTrackingContext(ctx, x, y);

    var genomeRange = this.props.range,
        range = new ContigInterval(genomeRange.contig, genomeRange.start, genomeRange.stop),
        scale = this.getScale(),
        // If click-tracking gets slow, this range could be narrowed to one
        // closer to the click coordinate, rather than the whole visible range.
        vGroups = this.cache.getGroupsOverlapping(range);

    renderPileup(trackingCtx, scale, range, vGroups);
    var vRead = _.find(trackingCtx.hits[0], hit => hit.read);
    var alert = window.alert || console.log;
    if (vRead) {
      alert(vRead.read.debugString());
    }
  }
}

PileupTrack.displayName = 'pileup';
PileupTrack.defaultOptions = {
  viewAsPairs: false
};


module.exports = PileupTrack;

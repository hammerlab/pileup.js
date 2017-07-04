/**
 * Pileup visualization of BAM sources.
 * @flow
 */
'use strict';

import type {Strand, Alignment, AlignmentDataSource} from '../Alignment';
import type {TwoBitSource} from '../sources/TwoBitDataSource';
import type {BasePair} from './pileuputils';
import type {VisualAlignment, VisualGroup, InsertStats} from './PileupCache';
import type {DataCanvasRenderingContext2D} from 'data-canvas';
import type Interval from '../Interval';
import type {VizProps} from '../VisualizationWrapper';
import type {Scale} from './d3utils';
import type {State, NetworkStatus} from '../types';

import React from 'react';
import shallowEquals from 'shallow-equals';
import _ from 'underscore';

import scale from '../scale';
import d3utils from './d3utils';
import {CigarOp} from './pileuputils';
import ContigInterval from '../ContigInterval';
import DisplayMode from './DisplayMode';
import PileupCache from './PileupCache';
import TiledCanvas from './TiledCanvas';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import style from '../style';


var READ_HEIGHT = 13;
var READ_SPACING = 2;  // vertical pixels between reads

var READ_STRAND_ARROW_WIDTH = 5;

// PhantomJS does not support setLineDash.
// Node doesn't even know about the symbol.
var SUPPORTS_DASHES = typeof(CanvasRenderingContext2D) !== 'undefined' &&
                      !!CanvasRenderingContext2D.prototype.setLineDash;

class PileupTiledCanvas extends TiledCanvas {
  cache: PileupCache;
  options: Object;

  constructor(cache: PileupCache, options: Object) {
    super();
    this.cache = cache;
    this.options = options;
  }

  update(newOptions: Object) {
    this.options = newOptions;
  }

  heightForRef(ref: string): number {
    return this.cache.pileupHeightForRef(ref) *
                    (READ_HEIGHT + READ_SPACING);
  }

  render(ctx: DataCanvasRenderingContext2D,
         scale: (x: number)=>number,
         range: ContigInterval<string>) {
    var relaxedRange =
        new ContigInterval(range.contig, range.start() - 1, range.stop() + 1);
    var vGroups = this.cache.getGroupsOverlapping(relaxedRange);
    var insertStats = this.options.colorByInsert ? this.cache.getInsertStats() : null;
    renderPileup(ctx, scale, relaxedRange, insertStats, this.options.colorByStrand, vGroups);
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
                      insertStats: ?InsertStats,
                      colorByStrand: boolean,
                      vGroups: VisualGroup[]) {
  // Should mismatched base pairs be shown as blocks of color or as letters?
  var pxPerLetter = scale(1) - scale(0),
      mode = DisplayMode.getDisplayMode(pxPerLetter),
      showText = DisplayMode.isText(mode);

  function drawArrow(pos: number, refLength: number, top: number, direction: 'L' | 'R') {
    var left = scale(pos + 1),
        right = scale(pos + refLength + 1),
        bottom = top + READ_HEIGHT,
        // Arrowheads become a distraction as you zoom out and the reads get
        // shorter. They should never be more than 1/6 the read length.
        arrowSize = Math.min(READ_STRAND_ARROW_WIDTH, (right - left) / 6);

    ctx.beginPath();
    if (direction == 'R') {
      ctx.moveTo(left, top);
      ctx.lineTo(right - arrowSize, top);
      ctx.lineTo(right, (top + bottom) / 2);
      ctx.lineTo(right - arrowSize, bottom);
      ctx.lineTo(left, bottom);
    } else {
      ctx.moveTo(right, top);
      ctx.lineTo(left + arrowSize, top);
      ctx.lineTo(left, (top + bottom) / 2);
      ctx.lineTo(left + arrowSize, bottom);
      ctx.lineTo(right, bottom);
    }
    ctx.fill();
  }

  function drawSegment(op, y, vRead) {
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
    ctx.save();
    if (colorByStrand) {
      ctx.fillStyle = vRead.strand == '+' ?
          style.ALIGNMENT_PLUS_STRAND_COLOR :
          style.ALIGNMENT_MINUS_STRAND_COLOR;
    }
    vRead.ops.forEach(op => {
      if (isRendered(op)) {
        drawSegment(op, y, vRead);
      }
    });
    vRead.mismatches.forEach(bp => renderMismatch(bp, y));
    ctx.restore();
    ctx.popObject();
  }

  function drawGroup(vGroup: VisualGroup) {
    ctx.save();
    if (insertStats && vGroup.insert) {
      var len = vGroup.span.length();
      if (len < insertStats.minOutlierSize) {
        ctx.fillStyle = 'blue';
      } else if (len > insertStats.maxOutlierSize) {
        ctx.fillStyle = 'red';
      } else {
        ctx.fillStyle = style.ALIGNMENT_COLOR;
      }
    } else {
      ctx.fillStyle = style.ALIGNMENT_COLOR;
    }
    var y = yForRow(vGroup.row);
    ctx.pushObject(vGroup);
    if (vGroup.insert) {
      var span = vGroup.insert,
          x1 = scale(span.start + 1),
          x2 = scale(span.stop + 1);
      ctx.fillRect(x1, y + READ_HEIGHT / 2 - 0.5, x2 - x1, 1);
    }
    vGroup.alignments.forEach(vRead => drawAlignment(vRead, y));
    ctx.popObject();
    ctx.restore();
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


class PileupTrack extends React.Component {
  props: VizProps & { source: AlignmentDataSource };
  state: State;
  cache: PileupCache;
  tiles: PileupTiledCanvas;
  static defaultOptions: { viewAsPairs: boolean };
  static getOptionsMenu: (options: Object) => any;
  static handleSelectOption: (key: string, oldOptions: Object) => Object;

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
    this.tiles = new PileupTiledCanvas(this.cache, this.props.options);

    this.props.source.on('newdata', range => {
      this.updateReads(range);
      this.tiles.invalidateRange(range);
      this.updateVisualization();
    });
    this.props.referenceSource.on('newdata', range => {
      this.cache.updateMismatches(range);
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
    var shouldUpdate = false;
    if (this.props.options != prevProps.options) {
      this.handleOptionsChange(prevProps.options);
      shouldUpdate = true;
    }

    if (!shallowEquals(this.props, prevProps) ||
        !shallowEquals(this.state, prevState) ||
        shouldUpdate) {
      this.updateVisualization();
    }
  }

  handleOptionsChange(oldOpts: Object) {
    this.tiles.invalidateAll();

    if (oldOpts.viewAsPairs != this.props.options.viewAsPairs) {
      this.cache = new PileupCache(this.props.referenceSource, this.props.options.viewAsPairs);
      this.tiles = new PileupTiledCanvas(this.cache, this.props.options);
      this.updateReads(ContigInterval.fromGenomeRange(this.props.range));
    } else if (oldOpts.colorByInsert != this.props.options.colorByInsert) {
      this.tiles.update(this.props.options);
      this.tiles.invalidateAll();
      this.updateVisualization();
    }

    if (oldOpts.sort != this.props.options.sort) {
      this.handleSort();
    }
  }

  // Load new reads into the visualization cache.
  updateReads(range: ContigInterval<string>) {
    var anyBefore = this.cache.anyGroupsOverlapping(range);
    this.props.source.getAlignmentsInRange(range)
                     .forEach(read => this.cache.addAlignment(read));

    if (!anyBefore && this.cache.anyGroupsOverlapping(range)) {
      // If these are the first reads to be shown in the visible range,
      // then sort them to highlight reads in the center.
      this.handleSort();
    }
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

    // This is a hack to mitigate #350
    var el = d3utils.findParent(this.refs.canvas, 'track-content');
    if (el) el.scrollLeft = 0;
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

  handleSort() {
    var {start, stop} = this.props.range,
        middle = (start + stop) / 2;
    this.cache.sortReadsAt(this.props.range.contig, middle);
    this.tiles.invalidateAll();
    this.updateVisualization();
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

    renderPileup(trackingCtx, scale, range, null, false, vGroups);
    var vRead = _.find(trackingCtx.hits[0], hit => hit.read);
    var alert = window.alert || console.log;
    if (vRead) {
      alert(vRead.read.debugString());
    }
  }
}

PileupTrack.displayName = 'pileup';
PileupTrack.defaultOptions = {
  viewAsPairs: false,
  colorByInsert: true,
  colorByStrand: false
};

PileupTrack.getOptionsMenu = function(options: Object): any {
  return [
    {key: 'view-pairs', label: 'View as pairs', checked: options.viewAsPairs},
    '-',
    {key: 'color-insert', label: 'Color by insert size', checked: options.colorByInsert},
    {key: 'color-strand', label: 'Color by strand', checked: options.colorByStrand},
    '-',
    {key: 'sort', label: 'Sort alignments'}
  ];
};

var messageId = 1;

PileupTrack.handleSelectOption = function(key: string, oldOptions: Object): Object {
  var opts = _.clone(oldOptions);
  if (key == 'view-pairs') {
    opts.viewAsPairs = !opts.viewAsPairs;
    return opts;
  } else if (key == 'color-insert') {
    opts.colorByInsert = !opts.colorByInsert;
    if (opts.colorByInsert) opts.colorByStrand = false;
    return opts;
  } else if (key == 'color-strand') {
    opts.colorByStrand = !opts.colorByStrand;
    if (opts.colorByStrand) opts.colorByInsert = false;
    return opts;
  } else if (key == 'sort') {
    opts.sort = (messageId++);
    return opts;
  }
  return oldOptions;  // no change
};


module.exports = PileupTrack;

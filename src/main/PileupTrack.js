/**
 * Pileup visualization of BAM sources.
 * @flow
 */
'use strict';

import type * as SamRead from './SamRead';
import type * as Interval from './Interval';

var React = require('./react-shim'),
    d3 = require('d3'),
    _ = require('underscore'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    utils = require('./utils'),
    d3utils = require('./d3utils'),
    {addToPileup, getOpInfo, CigarOp} = require('./pileuputils'),
    ContigInterval = require('./ContigInterval'),
    DisplayMode = require('./DisplayMode');


var READ_HEIGHT = 13;
var READ_SPACING = 2;  // vertical pixels between reads

var READ_STRAND_ARROW_WIDTH = 6;

// Returns an SVG path string for the read, with an arrow indicating strand.
function makeArrow(scale, pos, refLength, direction) {
  var left = scale(pos + 1),
      top = 0,
      right = scale(pos + refLength + 1),
      bottom = READ_HEIGHT,
      path = direction == 'R' ? [
        [left, top],
        [right - READ_STRAND_ARROW_WIDTH, top],
        [right, (top + bottom) / 2],
        [right - READ_STRAND_ARROW_WIDTH, bottom],
        [left, bottom]
      ] : [
        [right, top],
        [left + READ_STRAND_ARROW_WIDTH, top],
        [left, (top + bottom) / 2],
        [left + READ_STRAND_ARROW_WIDTH, bottom],
        [right, bottom]
      ];
  return d3.svg.line()(path);
}

// Create the SVG element for a single Cigar op in an alignment.
function enterSegment(parentNode, op, scale) {
  var parent = d3.select(parentNode);
  switch (op.op) {
    case CigarOp.MATCH:
      return parent.append(op.arrow ? 'path' : 'rect')
                   .attr('class', 'segment match');

    case CigarOp.DELETE:
      return parent.append('line')
                   .attr('class', 'segment delete');

    case CigarOp.INSERT:
      return parent.append('line')
                   .attr('class', 'segment insert');

    default:
      throw `Invalid op! ${op.op}`;
  }
}

// Update the selection for a single Cigar op, e.g. in response to a pan or zoom.
function updateSegment(node, op, scale) {
  switch (op.op) {
    case CigarOp.MATCH:
      if (op.arrow) {
        // an arrow pointing in the direction of the alignment
        d3.select(node).attr('d', makeArrow(scale, op.pos, op.length, op.arrow));
      } else {
        // a rectangle (interior part of an alignment)
        d3.select(node)
          .attr({
            'x': scale(op.pos + 1),
            'height': READ_HEIGHT,
            'width': scale(op.length) - scale(0)
          });
      }
      break;

    case CigarOp.DELETE:
      // A thin line in the middle of the alignments indicating the deletion.
      d3.select(node)
        .attr({
          'x1': scale(op.pos + 1),
          'x2': scale(op.pos + 1 + op.length),
          'y1': READ_HEIGHT / 2 - 0.5,
          'y2': READ_HEIGHT / 2 - 0.5
        });
      break;

    case CigarOp.INSERT:
      // A thin vertical line. This is shifted to the left so that it's not
      // hidden by the segment following it.
      d3.select(node)
        .attr({
          'x1': scale(op.pos + 1) - 2,  // to cover a bit of the previous segment
          'x2': scale(op.pos + 1) - 2,
          'y1': -1,
          'y2': READ_HEIGHT + 2
        });
      break;

    default:
      throw `Invalid op! ${op.op}`;
  }
}

// Should the Cigar op be rendered to the screen?
function isRendered(op) {
  return (op.op == CigarOp.MATCH ||
          op.op == CigarOp.DELETE ||
          op.op == CigarOp.INSERT);
}

function readClass(vread: VisualAlignment) {
  return 'alignment ' + (vread.strand == Strand.NEGATIVE ? 'negative' : 'positive');
}

// Copied from pileuputils.js
type BasePair = {
  pos: number;
  basePair: string;
  quality: number;
}

// This bundles everything intrinsic to the alignment that we need to display
// it, i.e. everything not dependend on scale/viewport.
type VisualAlignment = {
  key: string;
  read: SamRead;
  strand: number;  // see Strand below
  row: number;  // pileup row.
  refLength: number;  // span on the reference (accounting for indels)
  mismatches: Array<BasePair>;
};
var Strand = {
  POSITIVE: 0,
  NEGATIVE: 1
};


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

class PileupTrack extends React.Component {
  pileup: Array<Interval[]>;
  keyToVisualAlignment: {[key:string]: VisualAlignment};

  constructor(props: Object) {
    super(props);
    this.state = {
      reads: []
    };
    this.pileup = [];
    this.keyToVisualAlignment = {};
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
        <div ref='container' style={containerStyles}></div>
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
    var div = this.refs.container.getDOMNode();
    d3.select(div)
      .append('svg');

    this.props.source.on('newdata', range => {
      this.updateReads(range);
      this.updateVisualization();
    });
    this.props.referenceSource.on('newdata', () => {
      this.updateMismatches();
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

  // Attach visualization info to the read and cache it.
  addRead(read: SamRead, referenceSource: any): VisualAlignment {
    var key = read.getKey();
    if (key in this.keyToVisualAlignment) {
      return this.keyToVisualAlignment[key];
    }

    var range = read.getInterval(),
        refLength = range.length(),
        opInfo = getOpInfo(read, referenceSource);

    var visualAlignment = {
      key,
      read,
      strand: read.getStrand() == '+' ? Strand.POSITIVE : Strand.NEGATIVE,
      row: addToPileup(range.interval, this.pileup),
      refLength,
      ops: opInfo.ops,
      mismatches: opInfo.mismatches
    };

    this.keyToVisualAlignment[key] = visualAlignment;
    return visualAlignment;
  }

  // Updates reference mismatch information for previously-loaded reads.
  updateMismatches() {
    // TODO: dedupe with addRead()
    var referenceSource = this.props.referenceSource;
    for (var k in this.keyToVisualAlignment) {
      var vRead = this.keyToVisualAlignment[k],
          read = vRead.read,
          opInfo = getOpInfo(read, referenceSource);

      vRead.mismatches = opInfo.mismatches;
    }
  }

  // Load new reads into the visualization cache.
  updateReads(range: ContigInterval<string>) {
    var newReads = this.props.source.getAlignmentsInRange(range);

    var referenceSource = this.props.referenceSource;
    newReads.forEach(read => this.addRead(read, referenceSource));
  }

  // Update the D3 visualization to reflect the cached reads &
  // currently-visible range.
  updateVisualization() {
    var div = this.refs.container.getDOMNode(),
        width = this.props.width,
        svg = d3.select(div).select('svg');

    // Hold off until height & width are known.
    if (width === 0) return;

    // Height can only be computed after the pileup has been updated.
    var height = yForRow(this.pileup.length);
    var scale = this.getScale();

    svg.attr('width', width)
       .attr('height', height);

    // TODO: speed this up using an interval tree
    var genomeRange = this.props.range,
        range = new ContigInterval(genomeRange.contig, genomeRange.start, genomeRange.stop);
    var vReads = _.filter(this.keyToVisualAlignment,
                          vRead => vRead.refLength &&  // drop alignments w/o CIGARs
                                   vRead.read.getInterval().chrIntersects(range))

    var reads = svg.selectAll('.alignment')
       .data(vReads, vRead => vRead.key);

    // Enter
    reads.enter()
        .append('g')
        .attr('class', readClass)
        .attr('transform', vRead => `translate(0, ${yForRow(vRead.row)})`)
        .on('click', vRead => {
          window.alert(vRead.read.debugString());
        });

    var segments = reads.selectAll('.segment')
        .data(read => read.ops.filter(isRendered));

    // This is like segments.append(), but allows for different types of
    // elements depending on the datum.
    segments.enter().call(function(sel) {
      sel.forEach(function(el) {
        el.forEach(function(op) {
          var d = d3.select(op).datum();
          var element = enterSegment(el.parentNode, d, scale);
          updateSegment(element[0][0], d, scale);
        });
      });
    });

    // Mismatched base pairs
    var pxPerLetter = scale(1) - scale(0),
        mode = DisplayMode.getDisplayMode(pxPerLetter),
        showText = DisplayMode.isText(mode),
        modeWrapper = reads.selectAll('.mode-wrapper')
                           .data(vRead => vRead.mismatches.length ? [{vRead,mode}] : [],
                                 x => x.mode);
    modeWrapper.enter().append('g').attr('class', 'mode-wrapper');
    modeWrapper.exit().remove();

    var letter = modeWrapper.selectAll('.basepair')
        .data(d => d.vRead.mismatches, m => m.pos + m.basePair);

    letter.enter().append(showText ? 'text' : 'rect')
    if (showText) {
      letter.text(mismatch => mismatch.basePair)
    } else {
      letter
          .attr('y', 0)
          .attr('height', READ_HEIGHT)
    }
    letter.attr('class', mismatch => utils.basePairClass(mismatch.basePair))
          .attr('fill-opacity', mismatch => opacityForQuality(mismatch.quality));

    // Update
    segments.each(function(d, i) {
      updateSegment(this, d, scale);
    });
    reads.selectAll('text.basepair')
         .attr('x', mismatch => scale(1 + 0.5 + mismatch.pos));  // 0.5 = centered
    reads.selectAll('rect.basepair')
          .attr('x', mismatch => scale(1 + mismatch.pos))
          .attr('width', pxPerLetter - 1)

    // Exit
    reads.exit().remove();
    letter.exit().remove();
    segments.exit().remove();
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

/**
 * Pileup visualization of BAM sources.
 * @flow
 */
'use strict';

import type * as SamRead from './SamRead';
import type * as Interval from './Interval';

var React = require('./react-shim'),
    d3 = require('d3'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    utils = require('./utils'),
    {addToPileup, getOpInfo, CigarOp} = require('./pileuputils'),
    ContigInterval = require('./ContigInterval');

var PileupTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    onRangeChange: React.PropTypes.func.isRequired,
    source: React.PropTypes.object.isRequired,
    referenceSource: React.PropTypes.object.isRequired,
    cssClass: React.PropTypes.string
  },
  render: function(): any {
    var range = this.props.range;
    if (!range) {
      return <EmptyTrack />;
    }

    return <NonEmptyPileupTrack {...this.props} />;
  }
});


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

class NonEmptyPileupTrack extends React.Component {
  pileup: Array<Interval[]>;
  keyToVisualAlignment: {[key:string]: VisualAlignment};

  constructor(props) {
    super(props);
    this.state = {
      width: 0,
      height: 0,
      reads: []
    };
    this.pileup = [];
    this.keyToVisualAlignment = {};
  }

  render(): any {
    var className = ['pileup', this.props.cssClass || ''].join(' ');
    // These styles allow vertical scrolling to see the full pileup.
    // Adding a vertical scrollbar shrinks the visible area, but we have to act
    // as though it doesn't, since adjusting the scale would put it out of sync
    // with other tracks.
    var containerStyles = {
      'overflowY': 'auto',
      'overflowX': 'hidden',
      'height': '100%'
    };
    return (
      <div className={className}>
        <div ref='container' style={containerStyles}></div>
      </div>
    );
  }

  updateSize() {
    var div = this.refs.container.getDOMNode();
    this.setState({
      width: div.offsetWidth,
      height: div.offsetHeight
    });
  }

  componentDidMount() {
    window.addEventListener('resize', () => this.updateSize());
    this.updateSize();

    var div = this.refs.container.getDOMNode();
    d3.select(div)
      .append('svg');

    this.props.source.on('newdata', () => {
      var range = this.props.range,
          ci = new ContigInterval(range.contig, range.start, range.stop);
      this.setState({
        reads: this.props.source.getAlignmentsInRange(ci)
      });
    });
    this.props.referenceSource.on('newdata', () => {
      this.updateMismatches();
      this.updateVisualization();
    });

    this.updateVisualization();
  }

  getScale() {
    var range = this.props.range,
        width = this.state.width,
        offsetPx = range.offsetPx || 0;
    var scale = d3.scale.linear()
            .domain([range.start, range.stop + 1])  // 1 bp wide
            .range([-offsetPx, width - offsetPx]);
    return scale;
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
        !shallowEquals(this.state, prevState)) {
      this.updateVisualization();
    }
  }

  // Attach visualization info to the read and cache it.
  addRead(read: SamRead, referenceSource): VisualAlignment {
    var k = read.offset.toString();
    if (k in this.keyToVisualAlignment) {
      return this.keyToVisualAlignment[k];
    }

    var refLength = read.getReferenceLength();
    var range = read.getInterval();
    var key = read.offset.toString();

    var opInfo = getOpInfo(read, referenceSource);

    var visualAlignment = {
      key,
      read,
      strand: read.getStrand() == '+' ? Strand.POSITIVE : Strand.NEGATIVE,
      row: addToPileup(range.interval, this.pileup),
      refLength,
      ops: opInfo.ops,
      mismatches: opInfo.mismatches
    };

    this.keyToVisualAlignment[k] = visualAlignment;
    return visualAlignment;
  }

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

  updateVisualization() {
    var div = this.refs.container.getDOMNode(),
        width = this.state.width,
        svg = d3.select(div).select('svg');

    // Hold off until height & width are known.
    if (width === 0) return;

    var referenceSource = this.props.referenceSource;
    var vReads = this.state.reads.map(
            read => this.addRead(read, referenceSource))
        .filter(read => read.refLength);  // drop alignments w/o CIGARs

    // Height can only be computed after the pileup has been updated.
    var height = yForRow(this.pileup.length);
    var scale = this.getScale();

    svg.attr('width', width)
       .attr('height', height);

    var reads = svg.selectAll('.alignment')
       .data(vReads, vRead => vRead.key);

    // Enter
    var readsG = reads.enter()
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

    readsG.append('path');  // the alignment arrow

    var mismatchTexts = reads.selectAll('text.basepair')
        .data(vRead => vRead.mismatches, m => m.pos + m.basePair);
    
    mismatchTexts
        .enter()
        .append('text')
          .attr('class', mismatch => utils.basePairClass(mismatch.basePair))
          .text(mismatch => mismatch.basePair);

    // Update
    segments.each(function(d, i) {
      updateSegment(this, d, scale);
    });
    reads.selectAll('text')
         .attr('x', mismatch => scale(1 + 0.5 + mismatch.pos));  // 0.5 = centered

    // Exit
    reads.exit().remove();
    mismatchTexts.exit().remove();
    segments.exit().remove();
  }

}

NonEmptyPileupTrack.propTypes = {
  range: types.GenomeRange.isRequired,
  source: React.PropTypes.object.isRequired,
  referenceSource: React.PropTypes.object.isRequired,
  onRangeChange: React.PropTypes.func.isRequired,
  cssClass: React.PropTypes.string
};


var EmptyTrack = React.createClass({
  render: function() {
    return <div className='pileup empty'>Zoom in to see alignments</div>;
  }
});

module.exports = PileupTrack;

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
    {addToPileup, getDifferingBasePairs} = require('./pileuputils'),
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
function makePath(scale, visualRead: VisualAlignment) {
  var read = visualRead.read,
      left = scale(visualRead.read.pos + 1),
      top = 0,
      right = scale(read.pos + visualRead.refLength + 1) - 5,
      bottom = READ_HEIGHT,
      path = visualRead.strand == Strand.POSITIVE ? [
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

  componentDidMount() {
    var div = this.refs.container.getDOMNode();
    this.setState({
      width: div.offsetWidth,
      height: div.offsetHeight
    });
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
    var v = this.keyToVisualAlignment[k];
    if (v) return v;

    var refLength = read.getReferenceLength();
    var range = read.getInterval();
    var reference = referenceSource.getRangeAsString({
       contig: range.contig,
       start: range.start(),
       stop: range.stop()
    });

    var key = read.offset.toString();

    var visualAlignment = {
      key,
      read,
      strand: read.getStrand() == '+' ? Strand.POSITIVE : Strand.NEGATIVE,
      row: addToPileup(range.interval, this.pileup),
      refLength,
      mismatches: getDifferingBasePairs(read, reference)
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
          range = read.getInterval(),
          reference = referenceSource.getRangeAsString({
            contig: range.contig,
            start: range.start(),
            stop: range.stop()
          });

      vRead.mismatches = getDifferingBasePairs(read, reference);
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
        read => this.addRead(read, referenceSource));

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

    readsG.append('path');  // the alignment arrow
    var mismatchTexts = reads.selectAll('text.basepair')
        .data(vRead => vRead.mismatches, m => m.pos + m.basePair);
    
    mismatchTexts
        .enter()
        .append('text')
          .attr('class', mismatch => utils.basePairClass(mismatch.basePair))
          .text(mismatch => mismatch.basePair);

    // Update
    reads.select('path').attr('d', (read, i) => makePath(scale, read));
    reads.selectAll('text')
         .attr('x', mismatch => scale(1 + 0.5 + mismatch.pos));  // 0.5 = centered

    // Exit
    reads.exit().remove();
    mismatchTexts.exit().remove();
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

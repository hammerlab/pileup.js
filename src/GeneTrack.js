/**
 * Visualization of genes, including exons and coding regions.
 * @flow
 */
'use strict';

var React = require('react/addons'),
    _ = require('underscore'),
    d3 = require('d3'),
    types = require('./types'),
    bedtools = require('./bedtools'),
    Interval = require('./Interval');

var GeneTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    genes: React.PropTypes.array.isRequired,
    onRangeChange: React.PropTypes.func.isRequired
  },
  render: function(): any {
    var range = this.props.range;
    if (!range) {
      return <EmptyTrack />;
    }

    return <NonEmptyGeneTrack {...this.props} />;
  }
});


// D3 function to hide overlapping elements in a selection.
// nb: this is O(n^2) in the number of transcripts on-screen.
// TODO: move into a d3utils module
var PADDING = 10;  // empty pixels to require around each element.
function removeOverlapping(selection) {
  var rects = [];

  selection.each(function() {
    var bbox = this.getBoundingClientRect();
    var myInterval = new Interval(bbox.left - PADDING, bbox.right + PADDING);
    if (_.any(rects, r => myInterval.intersects(r))) {
      d3.select(this).attr('visibility', 'hidden');
    } else {
      rects.push(myInterval);
      d3.select(this).attr('visibility', 'visible');
    }
  });
}

var NonEmptyGeneTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange.isRequired,
    genes: React.PropTypes.array.isRequired,
    onRangeChange: React.PropTypes.func.isRequired
  },
  render: function() {
    return <div className="genes"></div>;
  },
  componentDidMount: function() {
    var div = this.getDOMNode(),
        svg = d3.select(div)
                .append('svg');

    // These define the left/right arrow patterns for sense/antisense genes.
    // The second <path> allows the arrow to be seen on top of an exon.
    var defs = svg.append('defs');
    defs[0][0].innerHTML = `
      <pattern id="antisense" patternUnits="userSpaceOnUse"
            width="30" height="9" x="0" y="-4">
        <path d="M5,0 L1,4 L5,8" class="main"></path>
        <path d="M4,0 L1,3 M1,5 L4,8" class="offset"></path>
      </pattern>
      <pattern id="sense" patternUnits="userSpaceOnUse"
            width="30" height="9" x="0" y="-4">
        <path d="M0,0 L4,4 L0,8" class="main"></path>
        <path d="M1,0 L4,3 M4,5 L1,8" class="offset"></path>
      </pattern>
    `;

    this.updateVisualization();
  },
  getScale: function() {
    var div = this.getDOMNode(),
        range = this.props.range,
        width = div.offsetWidth,
        offsetPx = range.offsetPx || 0;
    var scale = d3.scale.linear()
            .domain([range.start, range.stop + 1])  // 1 bp wide
            .range([-offsetPx, width - offsetPx]);
    return scale;
  },
  componentDidUpdate: function(prevProps: any, prevState: any) {
    // Check a whitelist of properties which could change the visualization.
    var newProps = this.props;
    if (!_.isEqual(newProps.genes, prevProps.genes) ||
        !_.isEqual(newProps.range, prevProps.range)) {
      this.updateVisualization();
    }
  },
  updateVisualization: function() {
    var div = this.getDOMNode(),
        width = div.offsetWidth,
        height = div.offsetHeight,
        svg = d3.select(div).select('svg');

    var scale = this.getScale(),
        // We can't clamp scale directly because of offsetPx.
        clampedScale = d3.scale.linear()
            .domain([scale.invert(0), scale.invert(width)])
            .range([0, width])
            .clamp(true);

    svg.attr('width', width)
       .attr('height', height);

    var genes = svg.selectAll('g.gene')
       .data(this.props.genes, gene => gene.id);

    // By default, the left of the arrow pattern goes to x=0 in SVG space.
    // We'd prefer it start at genome coordinate 0.
    // The "% 30" matches the pattern widths. It's there to fight roundoff.
    svg.selectAll('pattern').attr('patternTransform',
                                  `translate(${scale(0) % 30} 0)`);

    // Enter
    var geneGs = genes.enter()
        .append('g')
        .attr('class', 'gene');
    geneGs.append('text');
    var geneLineG = geneGs.append('g').attr('class', 'track');

    geneLineG.selectAll('rect.exon')
      .data(g => bedtools.splitCodingExons(g.exons, g.codingRegion))
      .enter()
      .append('rect')
        .attr('class', 'exon');

    geneLineG.append('line');
    geneLineG.append('rect').attr('class', 'strand');

    // The gene name goes in the center of the gene, modulo boundary effects.
    var textCenterX = g => {
      var p = g.position;
      return 0.5 * (clampedScale(p.start()) + clampedScale(p.stop()));
    };
    var scaledWidth = g => scale(g.position.stop()) - scale(g.position.start());

    var geneLineY = height / 4;

    // Enter & update
    var track = genes.selectAll('g.track')
        .attr('transform',
              g => `translate(0 ${geneLineY})`);

    genes.selectAll('text')
        .attr({
          'x': textCenterX,
          'y': geneLineY + 15
        })
        .text(g => g.name || g.id)
        .call(removeOverlapping);

    track.selectAll('line').attr({
      'x1': g => scale(g.position.start()),
      'x2': g => scale(g.position.stop()),
      'y1': 0,
      'y2': 0
    });

    track.selectAll('rect.strand')
        .attr({
          'y': -4,
          'height': 9,
          'x': g => scale(g.position.start()),
          'width': scaledWidth,
          'fill': g => `url(#${g.strand == '+' ? '' : 'anti'}sense)`,
          'stroke': 'none'
        });

    track.selectAll('rect.exon')
        .attr({
          'x':      exon => scale(exon.start),
          'width':  exon => scale(exon.stop) - scale(exon.start),
          'y':      exon => -3 * (exon.isCoding ? 2 : 1),
          'height': exon =>  6 * (exon.isCoding ? 2 : 1)
        });

    // Exit
    genes.exit().remove();
  }
});

var EmptyTrack = React.createClass({
  render: function() {
    return <div className="genes empty">Zoom in to see genes</div>;
  }
});

module.exports = GeneTrack;

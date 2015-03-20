/**
 * Visualization of genes, including exons and coding regions.
 * @flow
 */
'use strict';

var React = require('react/addons'),
    _ = require('underscore'),
    d3 = require('d3'),
    types = require('./types'),
    bedtools = require('./bedtools');

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
    var defs = svg.append('defs');
    var antiSense = defs.append('pattern')
        .attr({
          'id': 'antisense',
          'patternUnits': 'userSpaceOnUse',
          'width': 30,
          'height': 9,
          'x': 0,
          'y': -4
        });
    antiSense.append('path')
          .attr({
            'd': 'M5,0 L1,4 L5,8',  // Arrow pointing left
            'fill': 'none',
            'stroke-width': 1,
            'class': 'main'
          });
    antiSense.append('path')
          .attr({
            // 'd': 'M4,0 L0,4 L4,8',  // Arrow pointing left
            'd': 'M4,0 L1,3 M1,5 L4,8',  // offset 1, less center pixel
            'fill': 'none',
            'stroke-width': 1,
            'class': 'offset'
          });

    var sense = defs.append('pattern')
        .attr({
          'id': 'sense',
          'patternUnits': 'userSpaceOnUse',
          'width': 30,
          'height': 9,
          'x': 0,
          'y': -4
        });
    sense.append('path')
          .attr({
            'd': 'M0,0 L4,4 L0,8',  // Arrow pointing right
            'fill': 'none',
            'stroke-width': 1
          });
    sense.append('path')
          .attr({
            'd': 'M1,0 L4,3 M4,5 L1,8',  // offset 1, less center pixel
            'fill': 'none',
            'stroke-width': 1
          });

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
    // For now, just basePairs and range.
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
        range = this.props.range,
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
    svg.selectAll('pattern').attr('patternTransform',
                                  `translate(${scale(0) % 30} 0)`);

    // Enter
    var geneGs = genes.enter()
        .append('g')
        .attr('class', 'gene');
    geneGs.append('text');
    var geneLineG = geneGs.append('g').attr('class', 'track');

    geneLineG.selectAll('rect.exon')
      .data(g => bedtools.splitCodingExons(g.exons, g.codingRegion)
                    .map(x => [x, g.position.start()]))
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
        .text(g => g.name || g.id);

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
          'x': ([exon, gStart]) => scale(exon.start),
          'y':      ([exon]) => -3 * (exon.isCoding ? 2 : 1),
          'height': ([exon]) =>  6 * (exon.isCoding ? 2 : 1),
          'width':  ([exon]) => scale(exon.stop) - scale(exon.start)
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

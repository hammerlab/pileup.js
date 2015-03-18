/**
 * Visualization of genes, including exons and coding regions.
 * @flow
 */
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
    var defs = svg.append('defs')
    defs.append('pattern')
        .attr({
          'id': 'antisense',
          'patternUnits': 'userSpaceOnUse',
          'width': 30,
          'height': 9,
          'x': 0,
          'y': -4
        })
        .append('path')
          .attr({
            'd': 'M4,0 L0,4 L4,8',  // Arrow pointing left
            'fill': 'none',
            'stroke-width': 1
          });

    defs.append('pattern')
        .attr({
          'id': 'sense',
          'patternUnits': 'userSpaceOnUse',
          'width': 30,
          'height': 9,
          'x': 0,
          'y': -4
        })
        .append('path')
          .attr({
            'd': 'M0,0 L4,4 L0,8',  // Arrow pointing right
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
        range = this.props.range,
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

    // Enter
    var geneGs = genes.enter()
        .append('g')
        .attr('class', 'gene');
    geneGs.append('text');
    var geneLineG = geneGs.append('g').attr('class', 'track');
    geneLineG.append('line');
    geneLineG.append('rect').attr('class', 'strand');

    geneLineG.selectAll('rect.exon')
      .data(g => bedtools.splitCodingExons(g.exons, g.codingRegion)
                    .map(x => [x, g.position.start()]))
      .enter()
      .append('rect')
        .attr('class', 'exon')

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
              g => `translate(${scale(g.position.start())} ${geneLineY})`);

    genes.selectAll('text')
        .attr({
          'x': textCenterX,
          'y': geneLineY + 15
        })
        .text(g => g.name || g.id);

    track.selectAll('line').attr({
      'x1': 0,
      'x2': scaledWidth,
      'y1': 0,
      'y2': 0
    });

    track.selectAll('rect.strand')
        .attr({
          'y': -4,
          'height': 9,
          'x': 0,
          'width': scaledWidth,
          'fill': g => `url(#${g.strand == '+' ? '' : 'anti'}sense)`,
          'stroke': 'none'
        });

    track.selectAll('rect.exon')
        .attr({
          'x': ([exon, gStart]) => scale(exon.start - gStart) - scale(0),
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
    return <div className="genes empty">Zoom in to see genes</div>
  }
});

module.exports = GeneTrack;

var React = require('react/addons'),
    _ = require('underscore'),
    d3 = require('d3'),
    types = require('./types');

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
    range: types.GenomeRange,
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

    var g = svg.append('g');

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

    var scale = this.getScale();

    svg.attr('width', width)
       .attr('height', height);

    var g = svg.select('g');

    var genes = g.selectAll('line')
       .data(this.props.genes, gene => gene.id);

    // Enter
    genes.enter().append('line');

    // Enter & update
    genes
        .attr('x1', g => scale(g.position.start()))
        .attr('x2', g => scale(g.position.stop()))
        .attr('y1', height / 2)
        .attr('y2', height / 2)
        .attr('class', 'gene');

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

/*

TP53 record:

chr17
7512444
7531642

 1  ENST00000269305
 2  0
 3  -
 4  7513651
 5  7520637
 6  0
 7  11
 8  1289,107,74,137,110,113,184,279,22,102,223,
 9  0,2207,5133,5299,5779,6457,6651,7592,7980,8119,18975,
10  ENSG00000141510
11  TP53


 4: Transcript ID
 5: (always 0)
 6: Strand ("-" = right to left, "+" = left to right)
 7: left coordinate of translated region
 8: right coordinate of translated region
 9: (always 0)
10: number of exons
11: lengths of exons, left to right
12: start of exons offset from start of gene, left to right
13: Ensembl Gene ID
14: Canonical name

Here's a description of this format (http://genome.ucsc.edu/FAQ/FAQformat#format1)
 1. chrom
 2. chromStart
 3. chromEnd
 4. name
 5. score
 6. strand
 7. thickStart
 8. thickEnd
 9. itemRgb
10. blockCount
11. blockSize
11. blockStarts


exon 11: chr17:7512445-7513733
exon 10: chr17:7514652-7514758
exon  9: chr17:7517578-7517651
..
exon  1: chr17:7531420-7531642

  --->

exon 11: chr17:    0- 1288
exon 10: chr17: 2207- 2313
exon  9: chr17: 5133- 5206
..
exon  1: chr17:18975-19197



In "collapsed" view, IGV merges all transcripts onto the same line.


Also:
chr17
7517349
7531521
 0  ENST00000359597
 1  0
 2  -
 3  7517349
 4  7520637
 5  0
 6  10
 7  33,74,137,110,113,184,279,22,102,102,
 8  0,228,394,874,1552,1746,2687,3075,3214,14070,
 9  ENSG00000141510
10  TP53
*/

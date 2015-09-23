/**
 * Visualization of variants
 * @flow
 */
'use strict';

import type {VcfDataSource} from './VcfDataSource';
import type {Variant} from './vcf';

var React = require('./react-shim'),
    _ = require('underscore'),
    d3 = require('d3'),
    types = require('./react-types'),
    ContigInterval = require('./ContigInterval');


function variantKey(v: Variant): string {
  return `${v.contig}:${v.position}`;
}

var VariantTrack = React.createClass({
  displayName: 'variants',
  propTypes: {
    range: types.GenomeRange.isRequired,
    source: React.PropTypes.object.isRequired,
    onRangeChange: React.PropTypes.func.isRequired
  },
  render: function(): any {
    return <div></div>;
  },
  getVariantSource(): VcfDataSource {
    return this.props.source;
  },
  componentDidMount: function() {
    var div = this.getDOMNode();
    d3.select(div)
      .append('svg');
    this.updateVisualization();

    this.getVariantSource().on('newdata', () => {
      this.updateVisualization();
    });
  },
  getScale: function() {
    var range = this.props.range,
        width = this.props.width,
        offsetPx = range.offsetPx || 0;
    var scale = d3.scale.linear()
            .domain([range.start, range.stop + 1])  // 1 bp wide
            .range([-offsetPx, width - offsetPx]);
    return scale;
  },
  componentDidUpdate: function(prevProps: any, prevState: any) {
    // Check a whitelist of properties which could change the visualization.
    // TODO: this is imprecise; it would be better to deep check reads.
    var newProps = this.props;
    if (!_.isEqual(newProps.range, prevProps.range) ||
       prevState != this.state) {
      this.updateVisualization();
    }
  },
  updateVisualization: function() {
    var div = this.getDOMNode(),
        width = this.props.width,
        height = this.props.height,
        svg = d3.select(div).select('svg');

    // Hold off until height & width are known.
    if (width === 0) return;

    var range = this.props.range;
    var interval = new ContigInterval(range.contig, range.start, range.stop);
    var variants = this.getVariantSource().getFeaturesInRange(interval);

    var scale = this.getScale();
    var pxPerLetter = scale(1) - scale(0);

    svg.attr('width', width)
       .attr('height', height);

    var variantRects = svg.selectAll('.variant')
       .data(variants, variantKey);

    // Enter
    variantRects.enter()
        .append('rect')
        .attr('class', 'variant')
        .on('click', variant => {
          window.alert(JSON.stringify(variant));
        });

    // Update
    variantRects
        .attr('x', variant => scale(variant.position))
        .attr('y', height - 15)
        .attr('height', 14)
        .attr('width', pxPerLetter - 1);

    // Exit
    variantRects.exit().remove();
  }
});

module.exports = VariantTrack;

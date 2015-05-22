/**
 * Visualization of variants
 * @flow
 */
'use strict';

import type * as VcfDataSource from './VcfDataSource';

var React = require('./react-shim'),
    _ = require('underscore'),
    d3 = require('d3'),
    types = require('./react-types'),
    ContigInterval = require('./ContigInterval');

// Copy from vcf.js
type Variant = {
  contig: string;
  position: number;
  ref: string;
  alt: string;
  vcfLine: string;
}

// Copied from VcfDataSource
type VcfDataSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getFeaturesInRange: (range: ContigInterval<string>) => Variant[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
};

var VariantTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    onRangeChange: React.PropTypes.func.isRequired,
    source: React.PropTypes.object.isRequired,
    cssClass: React.PropTypes.string
  },
  render: function(): any {
    var range = this.props.range;
    if (!range) {
      return <EmptyTrack />;
    }

    return <NonEmptyVariantTrack {...this.props} />;
  }
});

function variantKey(v: Variant): string {
  return `${v.contig}:${v.position}`;
}

var NonEmptyVariantTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange.isRequired,
    source: React.PropTypes.object.isRequired,
    onRangeChange: React.PropTypes.func.isRequired,
    cssClass: React.PropTypes.string
  },
  getInitialState: function() {
    return {
      width: 0,
      height: 0
    };
  },
  render: function(): any {
    var className = ['variants', this.props.cssClass || ''].join(' ');
    return <div className={className}></div>;
  },
  getVariantSource(): VcfDataSource {
    return this.props.source;
  },
  updateSize: function() {
    var div = this.getDOMNode();
    this.setState({
      width: div.offsetWidth,
      height: div.offsetHeight
    });
  },
  componentDidMount: function() {
    window.addEventListener('resize', () => this.updateSize());
    this.updateSize();

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
        width = this.state.width,
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
        width = this.state.width,
        height = this.state.height,
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

var EmptyTrack = React.createClass({
  render: function() {
    return <div className='variants empty'>Zoom in to see variants</div>;
  }
});

module.exports = VariantTrack;

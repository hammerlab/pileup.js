/**
 * A track which shows an approximate
 * @flow
 */
'use strict';

var React = require('./react-shim'),
    _ = require('underscore'),
    d3 = require('d3'),
    shallowEquals = require('shallow-equals'),
    types = require('./react-types'),
    d3utils = require('./d3utils');

class ScaleTrack extends React.Component {
  constructor(props: Object) {
    super(props);
    this.state = {
      labelSize: {height: 0, width: 0}
    };
  }

  getScale() {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  render(): any {
    return <div ref='container'></div>;
  }

  componentDidMount() {
    var div = this.getDOMNode(),
        svg = d3.select(div).append('svg');

    svg.append('line').attr('class', 'scale-lline');
    svg.append('line').attr('class', 'scale-rline');

    var label = svg.append('text').attr('class', 'scale-label');
    var {height, width} = label.text("100 mb").node().getBBox();
    // Save the size information for precise calculation
    this.setState({
          labelSize: {height: height, width: width}
    });

    this.updateVisualization();
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    this.updateVisualization();
  }

  getDOMNode(): any {
    return this.refs.container.getDOMNode();
  }

  niceifyRange(viewSize: number): any {
    var shorts = ["bp", "kb", "mb", "gb"],
        power = Math.floor(Math.log10(viewSize)),
        thousandth = Math.floor(power / 3),  // 10^3 = 1000
        unit = shorts[thousandth],
        nearestThousandth = Math.pow(1000, thousandth),
        prefix = Math.floor(viewSize / nearestThousandth),
        scaleSize = nearestThousandth;

    // If the whole region is smaller than 1kb,
    //  then round it to the nearest tenth/hundredth instead of thousandth
    if(power < 3) {
      scaleSize = Math.pow(10, Math.floor(Math.log10(viewSize)));
      scaleSize = Math.floor(viewSize / scaleSize) * scaleSize;
      prefix = scaleSize;
    }

    return {prefix, unit, scaleSize};
  }

  updateVisualization() {
    var div = this.getDOMNode(),
        range = this.props.range,
        width = this.props.width,
        height = this.props.height,
        labelSize = this.state.labelSize,
        svg = d3.select(div).select('svg');

    svg.attr('width', width).attr('height', height);
    var scale = this.getScale();
    var midPoint = (range.stop + range.start + 1) / 2,
        viewSize = range.stop - range.start + 1,
        midX = width / 2,
        midY = height / 2;

    var {prefix, unit, scaleSize} = this.niceifyRange(viewSize);

    var midLabel = svg.select('.scale-label');
    var labelHeight = labelSize.height,
        labelWidth = labelSize.width;
    var labelPadding = labelWidth;
    midLabel
      .attr('x', midX)
      .attr('y', midY + (labelHeight / 3))
      .attr('text-anchor', 'middle')
      .text(prefix + " " + unit);

    var lineStart = scale(midPoint - (scaleSize / 2));
    var lineEnd = scale(midPoint + (scaleSize / 2));

    var leftLine = svg.select('.scale-lline');
    leftLine
      .attr('x1', lineStart)
      .attr('y1', midY)
      .attr('x2', midX - labelPadding)
      .attr('y2', midY);

    var rightLine = svg.select('.scale-rline');
    rightLine
      .attr('x1', midX + labelPadding)
      .attr('y1', midY)
      .attr('x2', lineEnd)
      .attr('y2', midY);
  }
}

ScaleTrack.propTypes = {
  range: types.GenomeRange.isRequired,
  onRangeChange: React.PropTypes.func.isRequired,
};
ScaleTrack.displayName = 'scale';

module.exports = ScaleTrack;

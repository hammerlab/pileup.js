/**
 * @flow
 */

var React = require('./react-shim'),
    types = require('./react-types');

var VisualizationWrapper = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    onRangeChange: React.PropTypes.func.isRequired,
    source: React.PropTypes.object.isRequired,
    referenceSource: React.PropTypes.object.isRequired,
    visualization: React.PropTypes.func.isRequired
  },

  getInitialState: function() {
    return {
      width: 0,
      height: 0
    }
  },

  updateSize() {
    var parentDiv = this.getDOMNode().parentNode;
    this.setState({
      width: parentDiv.offsetWidth,
      height: parentDiv.offsetHeight
    });
  },

  componentDidMount() {
    window.addEventListener('resize', () => this.updateSize());
    this.updateSize();
  },

  render: function(): any {
    var range = this.props.range;
    if (!range) {
      return <EmptyTrack className={this.props.visualization.displayName} />;
    }

    return React.createElement(this.props.visualization, {
      range: this.props.range,
      onRangeChange: this.props.onRangeChange,
      source: this.props.source,
      referenceSource: this.props.referenceSource,
      width: this.state.width,
      height: this.state.height
    });
  }
});

var EmptyTrack = React.createClass({
  render: function() {
    var className = this.props.className + ' empty';
    return <div className={className}></div>;
  }
});

module.exports = VisualizationWrapper;

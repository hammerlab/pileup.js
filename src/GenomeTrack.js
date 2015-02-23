/**
 * A track which displays a reference genome.
 * @flow
 */

var React = require('react'),
    types = require('./types');

var GenomeTrack = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    basePairs: React.PropTypes.string
  },
  render: function(): any {
    if (!this.props.range) {
      return <EmptyTrack />;
    }
    var range = this.props.range;
    var rangeLength = range.limit - range.start;
    if (rangeLength > 200) {
      return <EmptyTrack />;
    }

    if (!this.props.basePairs) {
      return <div>no data</div>;
    }

    return <div>{this.props.basePairs}</div>;
  }
});

var EmptyTrack = React.createClass({
  render: function() {
    return <div>Zoom in to see bases</div>
  }
});

module.exports = GenomeTrack;

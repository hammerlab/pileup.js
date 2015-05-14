/**
 * Root of the React component tree.
 * @flow
 */
'use strict';

import type * as SamRead from './SamRead';
import type {VisualizedTrack} from './types';

var React = require('./react-shim'),
    Controls = require('./Controls');


var Root = React.createClass({
  propTypes: {
    referenceSource: React.PropTypes.object.isRequired,
    tracks: React.PropTypes.array.isRequired,
    initialRange: React.PropTypes.object.isRequired
  },
  getInitialState: function() {
    return {
      contigList: ([]: string[]),
      range: (null: ?GenomeRange)
    };
  },
  componentDidMount: function() {
    // Note: flow is unable to infer this type through `this.propTypes`.
    var referenceSource = this.props.referenceSource;
    referenceSource.needContigs();

    referenceSource.on('contigs', () => {
      this.setState({
        contigList: referenceSource.contigList(),
      });
    });

    referenceSource.on('contigs', () => {
      this.handleRangeChange(this.props.initialRange);
    });
  },
  handleRangeChange: function(newRange: GenomeRange) {
    this.setState({range: newRange});

    // Inform all the sources of the range change (including referenceSource).
    this.props.tracks.forEach(track => {
      track.source.rangeChanged(newRange);
    });
  },
  makeReactElementFromTrack(key: string, track: VisualizedTrack): React.Element {
    return React.createElement(track.visualization, {
      key,
      range: this.state.range,
      onRangeChange: this.handleRangeChange,
      source: track.source,
      referenceSource: this.props.referenceSource,
      cssClass: track.track.cssClass,
    });
  },
  render: function(): any {
    // TODO: use a better key than index.
    var trackEls = this.props.tracks.map((t, i) => this.makeReactElementFromTrack(''+i, t));
    return (
      <div>
        <Controls contigList={this.state.contigList}
                  range={this.state.range}
                  onChange={this.handleRangeChange} />
        {trackEls}
      </div>
    );
  }
});

module.exports = Root;

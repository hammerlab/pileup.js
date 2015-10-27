/**
 * Root of the React component tree.
 * @flow
 */
'use strict';

import type {VisualizedTrack} from './types';

var React = require('react'),
    Controls = require('./Controls'),
    VisualizationWrapper = require('./VisualizationWrapper');


var Root = React.createClass({
  propTypes: {
    referenceSource: React.PropTypes.object.isRequired,
    tracks: React.PropTypes.array.isRequired,
    initialRange: React.PropTypes.object.isRequired
  },
  getInitialState: function() {
    return {
      contigList: this.props.referenceSource.contigList(),
      range: (null: ?GenomeRange)
    };
  },
  componentDidMount: function() {
    // Note: flow is unable to infer this type through `this.propTypes`.
    var referenceSource = this.props.referenceSource;

    referenceSource.on('contigs', () => {
      this.setState({
        contigList: referenceSource.contigList(),
      });
    });

    if (!this.state.range) {
      this.handleRangeChange(this.props.initialRange);
    }
    // in case the contigs came in between getInitialState() and here.
    this.setState({contigList: this.props.referenceSource.contigList()});
  },
  handleRangeChange: function(newRange: GenomeRange) {
    this.props.referenceSource.normalizeRange(newRange).then(range => {
      this.setState({range: range});

      // Inform all the sources of the range change (including referenceSource).
      this.props.tracks.forEach(track => {
        track.source.rangeChanged(range);
      });
    }).done();
  },
  makeDivForTrack(key: string, track: VisualizedTrack): React.Element {
    var trackEl = (
        <VisualizationWrapper visualization={track.visualization}
            range={this.state.range}
            onRangeChange={this.handleRangeChange}
            source={track.source}
            referenceSource={this.props.referenceSource}
          />);

    var className = ['track', track.visualization.component.displayName || '', track.track.cssClass || ''].join(' ');

    return (
      <div key={key} className={className}>
        <div className='track-label'>
          <span>{track.track.name || '(track name)'}</span>
        </div>
        <div className='track-content'>
          {trackEl}
        </div>
      </div>
    );
  },
  render: function(): any {
    // TODO: use a better key than index.
    var trackEls = this.props.tracks.map((t, i) => this.makeDivForTrack(''+i, t));
    return (
      <div className='pileup-root'>
        <div className='track controls'>
          <div className='track-label'>
            &nbsp;
          </div>
          <div className='track-content'>
            <Controls contigList={this.state.contigList}
                      range={this.state.range}
                      onRangeChange={this.handleRangeChange} />
          </div>
        </div>
        {trackEls}
      </div>
    );
  }
});

module.exports = Root;

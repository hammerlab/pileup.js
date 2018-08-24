/**
 * Root of the React component tree.
 * @flow
 */
'use strict';

import type {GenomeRange} from './types';
import type {TwoBitSource} from './sources/TwoBitDataSource';
import type {VisualizedTrack, VizWithOptions} from './types';

import React from 'react';
import Controls from './Controls';
import Menu from './Menu';
import VisualizationWrapper from './VisualizationWrapper';

type Props = {
  referenceSource: TwoBitSource;
  tracks: VisualizedTrack[];
  initialRange: GenomeRange;
};

type State = {
  contigList: string[];
  range: ?GenomeRange;
  settingsMenuKey: ?string;
  updateSize: boolean;
};

class Root extends React.Component<Props, State> {
  props: Props;
  state: State;
  trackReactElements: Array<Object>; //it's an array of reactelement that are created for tracks

  constructor(props: Object) {
    super(props);
    this.state = {
      contigList: this.props.referenceSource.contigList(),
      range: null,
      updateSize: false,
      settingsMenuKey: null
    };
    this.trackReactElements = [];
  }

  componentDidMount() {
    this.props.referenceSource.on('contigs', () => {
      this.setState({
        contigList: this.props.referenceSource.contigList(),
      });
    });

    if (!this.state.range) {
      this.handleRangeChange(this.props.initialRange);
    }
    // in case the contigs came in between getInitialState() and here.
    this.setState({contigList: this.props.referenceSource.contigList()});
  }

  handleRangeChange(newRange: GenomeRange) {
    // Do not propagate negative ranges
    if (newRange.start < 0) {
      newRange.start = 0;
    }
    this.props.referenceSource.normalizeRange(newRange).then(range => {
      this.setState({range: range});

      // Inform all the sources of the range change (including referenceSource).
      this.props.tracks.forEach(track => {
        track.source.rangeChanged(range);
      });
    }).done();
  }

  toggleSettingsMenu(key: string, e: SyntheticEvent<>) {
    if (this.state.settingsMenuKey == key) {
      this.setState({settingsMenuKey: null});
    } else {
      this.setState({settingsMenuKey: key});
    }
  }

  handleSelectOption(trackKey: string, optionKey: string) {
    this.setState({settingsMenuKey: null});
    var viz = this.props.tracks[Number(trackKey)].visualization;
    var oldOpts = viz.options;
    // $FlowIgnore: TODO remove flow suppression
    var newOpts = viz.component.handleSelectOption(optionKey, oldOpts);
    viz.options = newOpts;
    if (newOpts != oldOpts) {
      this.forceUpdate();
    }
  }

  makeDivForTrack(key: string, track: VisualizedTrack): React$Element<'div'> {
    //this should be improved, but I have no idea how (when trying to
    //access this.trackReactElements with string key, flow complains)
    var intKey = parseInt(key); 
    var trackEl = (
        <VisualizationWrapper visualization={track.visualization}
            range={this.state.range}
            onRangeChange={this.handleRangeChange.bind(this)}
            source={track.source}
            options={track.track.options}
            referenceSource={this.props.referenceSource}
            ref = {(c: React$ElementRef<Object>) => {this.trackReactElements[intKey]=c}}
          />);

    var trackName = track.track.name || '(track name)';

    var gearIcon = null,
        settingsMenu = null;
    // $FlowIgnore: TODO remove flow suppression
    if (track.visualization.component.getOptionsMenu) {
      gearIcon = (
          <span ref={'gear-' + key}
                className='gear'
                onClick={this.toggleSettingsMenu.bind(this, key)}>
            ⚙
          </span>
      );
    }

    if (this.state.settingsMenuKey == key) {
      var gear = this.refs['gear-' + key],
          gearX = gear.offsetLeft,
          gearW = gear.offsetWidth,
          gearY = gear.offsetTop;

      var menuStyle = {
        position: 'absolute',
        left: (gearX + gearW) + 'px',
        top: gearY + 'px'
      };
      // $FlowIgnore: TODO remove flow suppression
      var items = track.visualization.component.getOptionsMenu(track.visualization.options);
      settingsMenu = (
        <div className='menu-container' style={menuStyle}>
          <Menu header={trackName} items={items} onSelect={this.handleSelectOption.bind(this, key)} />
        </div>
      );
    }

    var className = ['track', track.visualization.component.displayName || '', track.track.cssClass || ''].join(' ');

    return (
      <div key={key} className={className}>
        <div className='track-label'>
          <span>{trackName}</span>
          <br/>
          {gearIcon}
          {settingsMenu}
        </div>
        <div className='track-content'>
          {trackEl}
        </div>
      </div>
    );
  }

  render(): any {
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
                      onChange={this.handleRangeChange.bind(this)} />
          </div>
        </div>
        {trackEls}
      </div>
    );
  }

  componentDidUpdate(prevProps: Props, prevState: Object) {
    if (this.state.updateSize) {
      for (var i=0;i<this.props.tracks.length;i++) {
        this.trackReactElements[i].setState({updateSize:this.state.updateSize});
      }
      this.state.updateSize=false;
    }
  }

}
Root.displayName = 'Root';

module.exports = Root;

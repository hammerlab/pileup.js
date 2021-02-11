/**
 * Root of the React component tree.
 * @flow
 */
'use strict';

import type {GenomeRange} from './types';
import type {TwoBitSource} from './sources/TwoBitDataSource';
import type {VisualizedTrack, VizWithOptions} from './types';
import type ContigInterval from './ContigInterval';
import utils from './utils';
import _ from 'underscore';

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
  contigList: ContigInterval[];
  range: ?GenomeRange;
  settingsMenuKey: ?string;
  updateSize: boolean;
};

class Root extends React.Component<Props, State> {
  props: Props;
  state: State;
  trackReactElements: Array<Object>; //it's an array of reactelement that are created for tracks
  outsideClickHandler: (a: any) => void;
  node: any; // used to track clicking outside this component

  constructor(props: Object) {
    super(props);
    this.state = {
      contigList: this.props.referenceSource.contigList(),
      range: null,
      updateSize: false,
      settingsMenuKey: null
    };
    this.trackReactElements = [];
    this.node = null;
    this.outsideClickHandler = this.handleOutsideClick.bind(this);
  }

  componentDidMount() {
    this.props.referenceSource.on('contigs', () => {
      this.updateOutOfBoundsChromosome();
    });

    if (!this.state.range) {
      this.handleRangeChange(this.props.initialRange);
    }
    // in case the contigs came in between getInitialState() and here.
    this.setState({contigList: this.props.referenceSource.contigList()});
  }

  handleRangeChange(newRange: GenomeRange) {

    // copy over range so you don't modify
    // this.state.range, which is bound to handleRangeChange
    var modifiedRange =  {
      contig: newRange.contig,
      start: newRange.start,
      stop: newRange.stop,
    };

    // Do not propagate negative ranges
    if (modifiedRange.start < 0) {
      modifiedRange.start = 0;
    }
    // Do not propogate ranges exceeding contig limit
    var contigInfo = _.find(this.state.contigList, ref => utils.isChrMatch(modifiedRange.contig, ref.contig));

    if (contigInfo != undefined) {
      if (modifiedRange.stop > contigInfo.stop()) {
        modifiedRange.stop = contigInfo.stop();
        if (modifiedRange.start > modifiedRange.stop) {
          modifiedRange.start = 0;
        }
      }
    }

    this.props.referenceSource.normalizeRange(modifiedRange).then(range => {
      this.setState({range: range});
      // Inform all the sources of the range change (including referenceSource).
      this.props.tracks.forEach(track => {
        track.source.rangeChanged(range);
      });
    }).done();
  }

  // key can be string or null
  toggleSettingsMenu(key: any, e: SyntheticEvent<>) {
    if (this.state.settingsMenuKey == key) {
      this.setState({settingsMenuKey: null});
      document.removeEventListener('click', this.outsideClickHandler, false);
    } else {
      this.setState({settingsMenuKey: key});
      // remove event listener for clicking off of menu
      document.addEventListener('click', this.outsideClickHandler, false);
    }
  }

  handleOutsideClick(e: SyntheticEvent<>) {
    // if menu is visible and click is outside of menu component,
    // toggle view off
    if (this.state.settingsMenuKey != null && this.state.settingsMenuKey != undefined) {
        if (!this.node.contains(e.target)) {
            this.toggleSettingsMenu(this.state.settingsMenuKey, e);
        }
    }
  }

  handleSelectOption(trackKey: string, item: Object) {
    var viz = this.props.tracks[Number(trackKey)].visualization;
    var oldOpts = viz.options;
    // $FlowIgnore: TODO remove flow suppression
    var newOpts = viz.component.handleSelectOption(item, oldOpts);
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
      var items = _.clone(track.visualization.component.getOptionsMenu(track.visualization.options));
      settingsMenu = (
        <div className='menu-container' style={menuStyle} ref={node => { this.node = node; }}>
          <Menu header={trackName} items={items}
          onClick={this.handleSelectOption.bind(this, key)}
         />
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

  updateOutOfBoundsChromosome(): any {
    // We don't want to allow users to go to regions that extend past the end of
    // a contig. This function truncates queries past the ends of a contig
    // and updates the required states.

    var current_contig = this.props.initialRange;
    if (this.state.range) {
      current_contig = this.state.range.contig;
    }

    var oldContig = _.find(this.state.contigList, ref =>
        utils.isChrMatch(current_contig,
        ref.contig));

    var contigList = this.props.referenceSource.contigList();

    var newContig = _.find(contigList, ref => utils.isChrMatch(current_contig, ref.contig));

    // only update if the current contig has new information regarding
    // the end of the chromosome AND the current range is out of bounds
    // with respect to chromosome length
    if (newContig == undefined) {
      this.setState({
        contigList: contigList
      });
    }

    if (newContig && oldContig) {
      if (!_.isEqual(oldContig, newContig)) {
        // only trigger state if current contig changed
        this.setState({
          contigList: contigList
        });
        if (this.state.range.stop > newContig.stop()) {
          this.handleRangeChange(this.state.range);
        }
      }
    }
  }

  componentDidUpdate(prevProps: Props, prevState: Object) {
    if (this.state.updateSize) {
      for (var i=0;i<this.props.tracks.length;i++) {
        this.trackReactElements[i].setState({updateSize:this.state.updateSize});
      }
      this.state.updateSize=false;
    }

    this.props.referenceSource.on('contigs', () => {
      this.updateOutOfBoundsChromosome();
    });
  }

}
Root.displayName = 'Root';

module.exports = Root;

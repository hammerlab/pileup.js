/**
 * Controls for zooming to particular ranges of the genome.
 * @flow
 */
'use strict';

import type {GenomeRange, PartialGenomeRange} from './types';

import React from 'react';
import _ from 'underscore';

import utils from './utils';
import Interval from './Interval';

type Props = {
  range: ?GenomeRange;
  contigList: string[];
  onChange: (newRange: GenomeRange)=>void;
};

type State = {
  // the base number to be used for absolute zoom
  // new ranges become 2*defaultHalfInterval**zoomLevel + 1
  // half interval is simply the span cut in half and excluding the center
  defaultHalfInterval: number;
};

class Controls extends React.Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Object) {
    super(props);
    this.state = {defaultHalfInterval:2};
  }

  makeRange(): GenomeRange {
    return {
      contig: this.refs.contig.value,
      start: Number(this.refs.start.value),
      stop: Number(this.refs.stop.value)
    };
  }

  completeRange(range: ?PartialGenomeRange): GenomeRange {
    range = range || {};
    if (range.start && range.stop === undefined) {
      // Construct a range centered around a value. This matches IGV.
      range.stop = range.start + 20;
      range.start -= 20;
    }

    if (range.contig) {
      // There are major performance issues with having a 'chr' mismatch in the
      // global location object.
      const contig = range.contig;
      var altContig = _.find(this.props.contigList, ref => utils.isChrMatch(contig, ref));
      if (altContig) range.contig = altContig;
    }

    return (_.extend(_.clone(this.props.range), range) : any);
  }

  handleContigChange(e: SyntheticEvent<>) {
    this.props.onChange(this.completeRange({contig: this.refs.contig.value}));
  }

  handleFormSubmit(e: SyntheticEvent<>) {
    e.preventDefault();
    var range = this.completeRange(utils.parseRange(this.refs.position.value));
    this.props.onChange(range);
    this.updateSlider(new Interval(range.start, range.stop));
  }

  handleSliderOnInput(){
    // value is a string, want valueAsNumber
    // slider has negative values to reverse its direction so we need to negate
    this.zoomAbs(-this.refs.slider.valueAsNumber);
  }

  // Sets the values of the input elements to match `props.range`.
  updateRangeUI() {
    const r = this.props.range;
    if (!r) return;

    this.refs.position.value = utils.formatInterval(new Interval(r.start, r.stop));

    if (this.props.contigList) {
      var contigIdx = this.props.contigList.indexOf(r.contig);
      this.refs.contig.selectedIndex = contigIdx;
    }
  }

  zoomIn(e: any) {
    e.preventDefault();
    this.zoomByFactor(utils.ZOOM_FACTOR.IN);
  }

  zoomOut(e: any) {
    e.preventDefault();
    this.zoomByFactor(utils.ZOOM_FACTOR.OUT);
  }

  // Updates the range using absScaleRange and a given zoom level
  // Abs or absolute because it doesn't rely on scaling the current range
  zoomAbs(level: number) {
    var r = this.props.range;
    if (!r) return;

    var iv = utils.absScaleRange(new Interval(r.start, r.stop), level, this.state.defaultHalfInterval);
    this.props.onChange({
      contig: r.contig,
      start: iv.start,
      stop: iv.stop
    });
  }

  zoomByFactor(factor: number) {
    var r = this.props.range;
    if (!r) return;

    var iv = utils.scaleRange(new Interval(r.start, r.stop), factor);
    this.props.onChange({
      contig: r.contig,
      start: iv.start,
      stop: iv.stop
    });
    this.updateSlider(iv);
  }

  // To be used if the range changes through a control besides the slider
  // Slider value is changed to roughly reflect the new range
  updateSlider(newInterval: Interval) {
    var newSpan = (newInterval.stop - newInterval.start);
    this.refs.slider.valueAsNumber = Math.ceil(-Math.log2(newSpan) + 1);
  }

  render(): any {
    var contigOptions = this.props.contigList
        ? this.props.contigList.map((contig, i) => <option key={i}>{contig}</option>)
        : null;

    // Note: input values are set in componentDidUpdate.
    return (
      <form className='controls' onSubmit={this.handleFormSubmit.bind(this)}>
        <select ref='contig' onChange={this.handleContigChange.bind(this)}>
          {contigOptions}
        </select>{' '}
        <input ref='position' type='text' />{' '}
        <button className='btn-submit' onClick={this.handleFormSubmit.bind(this)}>Go</button>{' '}
        <div className='zoom-controls'>
          <button className='btn-zoom-out' onClick={this.zoomOut.bind(this)}></button>{' '}
          <button className='btn-zoom-in' onClick={this.zoomIn.bind(this)}></button>
          <input className='zoom-slider' ref ='slider' type="range" min="-15" max="0" onInput={this.handleSliderOnInput.bind(this)}></input>
        </div>
      </form>
    );
  }

  componentDidUpdate(prevProps: Object) {
    if (!_.isEqual(prevProps.range, this.props.range)) {
      this.updateRangeUI();
    }
  }

  componentDidMount() {
    this.updateRangeUI();
  }
}

module.exports = Controls;

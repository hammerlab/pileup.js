/**
 * Controls for zooming to particular ranges of the genome.
 * @flow
 */
'use strict';

import type {PartialGenomeRange} from './types';

var React = require('react'),
    _ = require('underscore');

var types = require('./react-types'),
    utils = require('./utils'),
    Interval = require('./Interval');

var Controls = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    contigList: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    // XXX: can we be more specific than this with Flow?
    onChange: React.PropTypes.func.isRequired
  },
  makeRange: function(): GenomeRange {
    return {
      contig: this.refs.contig.value,
      start: Number(this.refs.start.value),
      stop: Number(this.refs.stop.value)
    };
  },
  completeRange: function(range: ?PartialGenomeRange): GenomeRange {
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

    return (_.extend({}, this.props.range, range) : any);
  },
  handleContigChange: function(e: SyntheticEvent) {
    this.props.onChange(this.completeRange({contig: this.refs.contig.value}));
  },
  handleFormSubmit: function(e: SyntheticEvent) {
    e.preventDefault();
    var range = this.completeRange(utils.parseRange(this.refs.position.value));
    this.props.onChange(range);
  },
  // Sets the values of the input elements to match `props.range`.
  updateRangeUI: function() {
    const r = this.props.range;
    if (!r) return;

    this.refs.position.value = utils.formatInterval(new Interval(r.start, r.stop));

    if (this.props.contigList) {
      var contigIdx = this.props.contigList.indexOf(r.contig);
      this.refs.contig.selectedIndex = contigIdx;
    }
  },
  zoomIn: function(e: any) {
    e.preventDefault();
    this.zoomByFactor(0.5);
  },
  zoomOut: function(e: any) {
    e.preventDefault();
    this.zoomByFactor(2.0);
  },
  zoomByFactor: function(factor: number) {
    var r = this.props.range;
    if (!r) return;

    var iv = utils.scaleRange(new Interval(r.start, r.stop), factor);
    this.props.onChange({
      contig: r.contig,
      start: iv.start,
      stop: iv.stop
    });
  },
  render: function(): any {
    var contigOptions = this.props.contigList
        ? this.props.contigList.map((contig, i) => <option key={i}>{contig}</option>)
        : null;

    // Note: input values are set in componentDidUpdate.
    return (
      <form className='controls' onSubmit={this.handleFormSubmit}>
        <select ref='contig' onChange={this.handleContigChange}>
          {contigOptions}
        </select>{' '}
        <input ref='position' type='text' />{' '}
        <button className='btn-submit' onClick={this.handleFormSubmit}>Go</button>{' '}
        <div className='zoom-controls'>
          <button className='btn-zoom-out' onClick={this.zoomOut}></button>{' '}
          <button className='btn-zoom-in' onClick={this.zoomIn}></button>
        </div>
      </form>
    );
  },
  componentDidUpdate: function(prevProps: Object) {
    if (!_.isEqual(prevProps.range, this.props.range)) {
      this.updateRangeUI();
    }
  },
  componentDidMount: function() {
    this.updateRangeUI();
  }
});

module.exports = Controls;

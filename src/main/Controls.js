/**
 * Controls for zooming to particular ranges of the genome.
 * @flow
 */
'use strict';

var React = require('react'),
    _ = require('underscore');

var types = require('./react-types'),
    utils = require('./utils'),
    Interval = require('./Interval');

var Controls = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    contigList: React.PropTypes.arrayOf(React.PropTypes.string),
    // XXX: can we be more specific than this with Flow?
    onRangeChange: React.PropTypes.func.isRequired
  },
  makeRange: function(): GenomeRange {
    return {
      contig: this.refs.contig.value,
      start: Number(this.refs.start.value),
      stop: Number(this.refs.stop.value)
    };
  },
  handleContigChange: function(e: SyntheticEvent) {
    this.props.onRangeChange(this.makeRange());
  },
  handleFormSubmit: function(e: SyntheticEvent) {
    e.preventDefault();
    this.props.onRangeChange(this.makeRange());
  },
  // Sets the values of the input elements to match `props.range`.
  updateRangeUI: function() {
    var r = this.props.range || {contig: '', start: '', stop: ''};
    this.refs.start.value = r.start;
    this.refs.stop.value = r.stop;

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
    this.props.onRangeChange({
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
        <select ref='contig' onRangeChange={this.handleContigChange}>
          {contigOptions}
        </select>{' '}
        <input ref='start' type='text' />–
        <input ref='stop' type='text' />{' '}
        <button className='btn-submit'>Go</button>{' '}
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

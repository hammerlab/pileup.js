/**
 * Controls for zooming to particular ranges of the genome.
 * @flow
 */

var React = require('react'),
    types = require('./types'),
    _ = require('underscore');

var Controls = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    contigList: React.PropTypes.arrayOf(React.PropTypes.string),
    // XXX: can we be more specific than this with Flow?
    onChange: React.PropTypes.func.isRequired
  },
  makeRange: function(): GenomeRange {
    return {
      contig: this.refs.contig.getDOMNode().value,
      start: Number(this.refs.start.getDOMNode().value),
      stop: Number(this.refs.stop.getDOMNode().value)
    };
  },
  handleContigChange: function(e: SyntheticEvent) {
    this.props.onChange(this.makeRange());
  },
  handleFormSubmit: function(e: SyntheticEvent) {
    e.preventDefault();
    this.props.onChange(this.makeRange());
  },
  // Sets the values of the input elements to match `props.range`.
  updateRangeUI: function() {
    var r = this.props.range || {contig: '', start: '', stop: ''};
    this.refs.start.getDOMNode().value = r.start;
    this.refs.stop.getDOMNode().value = r.stop;

    if (this.props.contigList) {
      var contigIdx = this.props.contigList.indexOf(r.contig);
      this.refs.contig.getDOMNode().selectedIndex = contigIdx;
    }
  },
  render: function(): any {
    var contigOptions = this.props.contigList
        ? this.props.contigList.map((contig, i) => <option key={i}>{contig}</option>)
        : null;

    // Note: input values are set in componentDidUpdate.
    return (
      <form className='controls' onSubmit={this.handleFormSubmit}>
        Contig:
        <select ref='contig' onChange={this.handleContigChange}>
          {contigOptions}
        </select>
        <input ref='start' type='text' />
        <input ref='stop' type='text' />
        <button>Go</button>
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

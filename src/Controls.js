/**
 * Controls for zooming to particular ranges of the genome.
 * @flow
 */

var React = require('react'),
    types = require('./types');

var Controls = React.createClass({
  propTypes: {
    range: types.GenomeRange,
    contigList: React.PropTypes.arrayOf(React.PropTypes.string),
    // XXX: can we be more specific than this with Flow?
    onChange: React.PropTypes.func.isRequired
  },
  handleChange: function(e: SyntheticEvent) {
    var range = {
      contig: this.refs.contig.getDOMNode().value,
      start: Number(this.refs.start.getDOMNode().value),
      stop: Number(this.refs.stop.getDOMNode().value)
    };
    // XXX this should be a type error w/o the Number() above, but it isn't.
    this.props.onChange(range);
  },
  render: function(): any {
    var contigOptions = this.props.contigList
        ? this.props.contigList.map((contig, i) => <option key={i}>{contig}</option>)
        : null;

    // TODO: this is broken. The UI should show the current range _and_ allow editing.
    var r = this.props.range || {contig: null, start: null, stop: null};

    return (
      <div className='controls'>
        Contig:
        <select ref='contig' onChange={this.handleChange}>
          {contigOptions}
        </select>
        <input ref='start' type='text' value={r.start} readOnly />
        <input ref='stop' type='text' value={r.stop} readOnly />
        <button onClick={this.handleChange}>Update</button>
      </div>
    );
  }
});

module.exports = Controls;

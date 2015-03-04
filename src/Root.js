/**
 * Root of the React component tree.
 * @flow
 */

var React = require('react'),
    Controls = require('./Controls'),
    GenomeTrack = require('./GenomeTrack'),
    types = require('./types'),
    // TODO: make this an "import type" when react-tools 0.13.0 is out.
    TwoBit = require('./TwoBit');

var Root = React.createClass({
  propTypes: {
    referenceSource: React.PropTypes.object.isRequired
  },
  getInitialState: function(): any {
    return {
      contigList: [],
      range: null,
      basePairs: null
    }
  },
  componentDidMount: function() {
    // Note: flow is unable to infer this type through `this.propTypes`.
    var ref: TwoBit = this.props.referenceSource;
    ref.getContigList().then(contigList => {
      this.setState({contigList});
      // this is here to facilitate faster iteration
      this.handleRangeChange({
        contig: 'chr1',
        start: 123456,
        stop: 123500
      });
    }).done();
  },
  handleRangeChange: function(newRange: GenomeRange) {
    this.setState({range: newRange, basePairs: null});
    var ref = this.props.referenceSource;
    ref.getFeaturesInRange(newRange.contig, newRange.start, newRange.stop)
       .then(basePairs => {
         this.setState({basePairs});
       }).done();
  },
  render: function(): any {
    return (
      <div>
        <Controls contigList={this.state.contigList}
                  range={this.state.range}
                  onChange={this.handleRangeChange} />
        <GenomeTrack range={this.state.range}
                     basePairs={this.state.basePairs}
                     onRangeChange={this.handleRangeChange} />
      </div>
    );
  }
});

module.exports = Root;

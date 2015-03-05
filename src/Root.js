/**
 * Root of the React component tree.
 * @flow
 */

var React = require('react'),
    Controls = require('./Controls'),
    GenomeTrack = require('./GenomeTrack'),
    types = require('./types');
    // TODO: make this an "import type" when react-tools 0.13.0 is out.

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
    var source: TwoBitDataSource = this.props.referenceSource;
    source.needContigs();

    source.on('contigs', () => { this.update() })
          .on('newdata', () => { this.update() })

    source.on('contigs', () => {
      // this is here to facilitate faster iteration
      this.handleRangeChange({
        contig: 'chr1',
        start: 123456,
        stop: 123500
      });
    });

    this.update();
  },
  update: function() {
    this.setState({
      contigList: this.props.referenceSource.contigList(),
      basePairs: this.props.referenceSource.getRange(this.state.range)
    });
  },
  handleRangeChange: function(newRange: GenomeRange) {
    this.setState({range: newRange});
    this.update();

    var ref = this.props.referenceSource;
    ref.rangeChanged(newRange);
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

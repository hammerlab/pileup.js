/**
 * Root of the React component tree.
 * @flow
 */
'use strict';

var React = require('react'),
    ContigInterval = require('./ContigInterval'),
    Controls = require('./Controls'),
    GenomeTrack = require('./GenomeTrack'),
    GeneTrack = require('./GeneTrack');


var Root = React.createClass({
  propTypes: {
    referenceSource: React.PropTypes.object.isRequired,
    geneSource: React.PropTypes.object.isRequired,
    initialRange: React.PropTypes.object.isRequired
  },
  getInitialState: function() {
    return {
      contigList: ([]: string[]),
      range: (null: ?GenomeRange),
      basePairs: (null: any),
      genes: ([]: Array<any>)  // TODO import Gene type
    };
  },
  componentDidMount: function() {
    // Note: flow is unable to infer this type through `this.propTypes`.
    var source = this.props.referenceSource;
    source.needContigs();

    source.on('contigs', () => { this.update() })
          .on('newdata', () => { this.update() });

    source.on('contigs', () => {
      // this is here to facilitate faster iteration
      this.handleRangeChange(this.props.initialRange);
    });

    var geneSource = this.props.geneSource;
    geneSource.on('newdata', () => { this.update() });

    this.update();
  },
  update: function() {
    var range = this.state.range,
        ci = range && new ContigInterval(range.contig, range.start, range.stop);
    this.setState({
      contigList: this.props.referenceSource.contigList(),
      basePairs: this.props.referenceSource.getRange(range),
      genes: this.props.geneSource.getGenesInRange(ci)
    });
  },
  handleRangeChange: function(newRange: GenomeRange) {
    this.setState({range: newRange});
    this.update();

    var ref = this.props.referenceSource;
    ref.rangeChanged(newRange);

    this.props.geneSource.rangeChanged(newRange);
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
        <GeneTrack range={this.state.range}
                   genes={this.state.genes}
                   onRangeChange={this.handleRangeChange} />

      </div>
    );
  }
});

module.exports = Root;

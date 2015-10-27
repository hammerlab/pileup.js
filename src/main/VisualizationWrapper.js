/**
 * @flow
 */
'use strict';

var React = require('react'),
    ReactDOM = require('react-dom'),
    _ = require('underscore'),
    d3 = require('../lib/minid3');

var types = require('./react-types'),
    d3utils = require('./d3utils'),
    utils = require('./utils'),
    Interval = require('./Interval');

class VisualizationWrapper extends React.Component {
  hasDragBeenInitialized: boolean;

  constructor(props: Object) {
    super(props);
    this.hasDragBeenInitialized = false;
    this.state = {
      width: 0,
      height: 0
    };
  }

  updateSize(): any {
    var parentDiv = ReactDOM.findDOMNode(this).parentNode;
    this.setState({
      width: parentDiv.offsetWidth,
      height: parentDiv.offsetHeight
    });
  }

  componentDidMount(): any {
    window.addEventListener('resize', () => this.updateSize());
    this.updateSize();

    if (this.props.range && !this.hasDragBeenInitialized) this.addDragInterface();
  }

  componentDidUpdate(): any {
    if (this.props.range && !this.hasDragBeenInitialized) this.addDragInterface();
  }

  getScale(): any {
    return d3utils.getTrackScale(this.props.range, this.state.width);
  }

  addDragInterface(): any {
    this.hasDragBeenInitialized = true;
    var div = ReactDOM.findDOMNode(this);
    var originalRange, originalScale, dx=0;
    var dragstarted = () => {
      d3.event.sourceEvent.stopPropagation();
      dx = 0;
      originalRange = _.clone(this.props.range);
      originalScale = this.getScale();
    };
    var updateRange = () => {
      if (!originalScale) return;  // can never happen, but Flow don't know.
      if (!originalRange) return;  // can never happen, but Flow don't know.
      var newStart = originalScale.invert(-dx),
          intStart = Math.round(newStart),
          offsetPx = originalScale(newStart) - originalScale(intStart);

      var newRange = {
        contig: originalRange.contig,
        start: intStart,
        stop: intStart + (originalRange.stop - originalRange.start),
        offsetPx: offsetPx
      };
      this.props.onRangeChange(newRange);
    };
    var dragmove = () => {
      dx += d3.event.dx;  // these are integers, so no roundoff issues.
      updateRange();
    };
    function dragended() {
      updateRange();
    }

    var drag = d3.behavior.drag()
        .on('dragstart', dragstarted)
        .on('drag', dragmove)
        .on('dragend', dragended);

    d3.select(div).call(drag).on('click', this.handleClick.bind(this));

    // This is saved in a member var for later removal via removeEventListener.
    // this.dblClickListener = e => {
    //   e.preventDefault();
    //   this.handleDoubleClick();
    // };
    // div.addEventListener('dblclick', this.dblClickListener);
  }

  handleClick(): any {
    if (d3.event.defaultPrevented) {
      d3.event.stopPropagation();
    } else {
    }
  }

  handleDoubleClick(): any {
    var r = this.props.range;
    var iv = utils.scaleRange(new Interval(r.start, r.stop), 0.5);
    this.props.onRangeChange({
      contig: r.contig,
      start: iv.start,
      stop: iv.stop
    });
  }

  render(): any {
    var range = this.props.range;
    var component = this.props.visualization.component;
    if (!range) {
      return <EmptyTrack className={component.displayName} />;
    }

    var el = React.createElement(component, {
      range: this.props.range,
      source: this.props.source,
      referenceSource: this.props.referenceSource,
      width: this.state.width,
      height: this.state.height,
      options: this.props.visualization.options
    });

    return <div className='drag-wrapper'>{el}</div>;
  }

  componentWillUnmount() {
    if (this.dblClickListener) {
      var div = ReactDOM.findDOMNode(this);
      div.removeEventListener('dblclick', this.dblClickListener);
    }
  }
}
VisualizationWrapper.displayName = 'VisualizationWrapper';

VisualizationWrapper.propTypes = {
  range: types.GenomeRange,
  onRangeChange: React.PropTypes.func.isRequired,
  source: React.PropTypes.object.isRequired,
  referenceSource: React.PropTypes.object.isRequired,
  visualization: React.PropTypes.object.isRequired,
};


var EmptyTrack = React.createClass({
  render: function() {
    var className = this.props.className + ' empty';
    return <div className={className}></div>;
  }
});

module.exports = VisualizationWrapper;

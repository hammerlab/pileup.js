/**
 * Common types used in many React components.
 * @flow
 */
'use strict';

var React = require('./react-shim');

module.exports = {
  // A range in a genome. Note: may be null.
  GenomeRange: React.PropTypes.shape({
    contig: React.PropTypes.string,
    start: React.PropTypes.number,
    stop: React.PropTypes.number,
    offsetPx: React.PropTypes.number
  })
};

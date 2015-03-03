/**
 * Common types used in many React components.
 * @flow
 */
var React = require('react');

module.exports = {
  // A range in a genome. Note: may be null.
  GenomeRange: React.PropTypes.shape({
    contig: React.PropTypes.string,
    start: React.PropTypes.number,
    stop: React.PropTypes.number,
    offsetPx: React.PropTypes.number
  })
};

/**
 * The "glue" between TwoBit.js and GenomeTrack.js.
 *
 * GenomeTrack is pure view code -- it renders data which is already in-memory
 * in the browser.
 *
 * TwoBit is purely for data parsing and fetching. It only knows how to return
 * promises for various genome features.
 *
 * This code acts as a bridge between the two. It maintains a local version of
 * the data, fetching remote data and informing the view when it becomes
 * available.
 *
 * @flow
 */
'use strict';

// import type * as TwoBit from './TwoBit';

var Events = require('backbone').Events,
    Q = require('q'),
    _ = require('underscore');

// TODO: make this an "import type" when react-tools 0.13.0 is out.
var TwoBit = require('./TwoBit');

// Factor by which to over-request data from the network.
// If a range of 100bp is shown and this is 2.0, then 300 base pairs will be
// requested over the network (100 * 2.0 too much)
var EXPANSION_FACTOR = 2.0;

var MAX_BASE_PAIRS_TO_FETCH = 10000;


// Flow type for export.
type TwoBitSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  needContigs: () => void;
  getRange: (range: GenomeRange) => ?{[key:string]: string};
  contigList: () => string[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}

// Expand range by EXPANSION_FACTOR, allowing for boundary effects and
// respecting MAX_BASE_PAIRS_TO_FETCH.
function expandRange(range) {
  var span = range.stop - range.start,
      center = range.start + span / 2,
      newSpan = Math.min(MAX_BASE_PAIRS_TO_FETCH, (1 + EXPANSION_FACTOR) * span),
      newStart = Math.max(1, Math.floor(center - newSpan / 2)),
      newStop = Math.ceil(center + newSpan / 2);

  return {
    contig: range.contig,
    start: newStart,
    stop: newStop
  }
}


// TODO: make the return type more precise
var createTwoBitDataSource = function(remoteSource: TwoBit): TwoBitSource {
  // Local cache of genomic data.
  var contigList = [];
  var basePairs = {};  // contig -> locus -> letter
  function getBasePair(contig: string, position: number) {
    return (basePairs[contig] && basePairs[contig][position]) || null;
  }
  function setBasePair(contig: string, position: number, letter: string) {
    if (!basePairs[contig]) basePairs[contig] = {};
    basePairs[contig][position] = letter;
  }

  function fetch(range: GenomeRange) {
    var span = range.stop - range.start;
    if (span > MAX_BASE_PAIRS_TO_FETCH) {
      return Q.when(null);  // empty promise
    }

    var oldRange = range;
    range = expandRange(range);
    console.log('expanded ', oldRange, ' to ', range);

    console.log(`Fetching ${span} base pairs`);
    return remoteSource.getFeaturesInRange(range.contig, range.start, range.stop)
        .then(letters => {
          for (var i = 0; i < letters.length; i++) {
            setBasePair(range.contig, range.start + i, letters[i]);
          }
        });
  }

  // Returns a {"chr12:123" -> "[ATCG]"} mapping for the range.
  function getRange(range: GenomeRange) {
    if (!range) return null;
    var span = range.stop - range.start;
    if (span > MAX_BASE_PAIRS_TO_FETCH) {
      return {};
    }
    return _.chain(_.range(range.start, range.stop + 1))
        .map(x => [range.contig + ':' + x, getBasePair(range.contig, x)])
        .object()
        .value();
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      // Range has changed! Fetch new data.
      // TODO: only fetch it if it isn't cached already.
      fetch(newRange)
          .then(() => o.trigger('newdata', newRange))
          .done();
    },
    needContigs: () => {
      remoteSource.getContigList().then(c => {
        contigList = c;
        o.trigger('contigs', contigList);
      }).done();
    },
    getRange: getRange,
    contigList: () => contigList,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
};

module.exports = createTwoBitDataSource;

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
    _ = require('underscore'),
    TwoBit = require('./TwoBit');

var ContigInterval = require('./ContigInterval');

import type {Track} from './types';


// Requests for 2bit ranges are expanded to begin & end at multiples of this
// constant. Doing this means that panning typically won't require
// additional network requests.
var BASE_PAIRS_PER_FETCH = 1000;

var MAX_BASE_PAIRS_TO_FETCH = 2000;


// Flow type for export.
type TwoBitSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  needContigs: () => void;
  getRange: (range: GenomeRange) => ?{[key:string]: string};
  getRangeAsString: (range: GenomeRange) => string;
  contigList: () => string[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}

// Expand range to begin and end on multiples of BASE_PAIRS_PER_FETCH.
function expandRange(range) {
  var roundDown = x => x - x % BASE_PAIRS_PER_FETCH;
  var newStart = Math.max(1, roundDown(range.start())),
      newStop = roundDown(range.stop() + BASE_PAIRS_PER_FETCH - 1);

  return new ContigInterval(range.contig, newStart, newStop);
}


var create = function(remoteSource: TwoBit): TwoBitSource {
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
  // Are all base pairs in the interval known? If so, no need to fetch.
  function isEntirelyKnown(interval: ContigInterval<string>) {
    for (var i = interval.start(); i <= interval.stop(); i++) {
      if (getBasePair(interval.contig, i) === null) return false;
    }
    return true;
  }

  function fetch(range: ContigInterval) {
    var span = range.stop() - range.start();
    if (span > MAX_BASE_PAIRS_TO_FETCH) {
      return Q.when();  // empty promise
    }
    if (isEntirelyKnown(range)) {
      return Q.when();
    }

    range = expandRange(range);

    console.log(`Fetching ${span} base pairs`);
    return remoteSource.getFeaturesInRange(range.contig, range.start(), range.stop())
        .then(letters => {
          for (var i = 0; i < letters.length; i++) {
            setBasePair(range.contig, range.start() + i, letters[i]);
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

  // Returns a string of base pairs for this range.
  function getRangeAsString(range: GenomeRange): string {
    if (!range) return '';
    return _.range(range.start, range.stop + 1)
        .map(x => getBasePair(range.contig, x) || '.')
        .join('');
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      // Range has changed! Fetch new data.
      var range = new ContigInterval(newRange.contig, newRange.start, newRange.stop);

      fetch(range)
          .then(() => o.trigger('newdata', range))
          .done();
    },
    needContigs: () => {
      remoteSource.getContigList().then(c => {
        contigList = c;
        o.trigger('contigs', contigList);
      }).done();
    },
    getRange,
    getRangeAsString,
    contigList: () => contigList,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
};

function createFromTrack(track: Track): TwoBitSource {
  if (track.type != 'reference') throw 'Miswired track';
  var url = track.data.url;
  if (!url) {
    throw new Error(`Missing URL from track: ${JSON.stringify(track)}`);
  }
  if (url.slice(-5) != '.2bit') {
    console.warn(`Expected reference track URL to have a .2bit extension: ${url}`);
  }

  return create(new TwoBit(url));
}

module.exports = {
  create,
  createFromTrack
};

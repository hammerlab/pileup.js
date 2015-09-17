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

var Events = require('backbone').Events,
    Q = require('q'),
    _ = require('underscore'),
    TwoBit = require('./TwoBit'),
    RemoteFile = require('./RemoteFile'),
    utils = require('./utils');

var ContigInterval = require('./ContigInterval');


// Requests for 2bit ranges are expanded to begin & end at multiples of this
// constant. Doing this means that panning typically won't require
// additional network requests.
var BASE_PAIRS_PER_FETCH = 1000;

var MAX_BASE_PAIRS_TO_FETCH = 2000;


// Flow type for export.
export type TwoBitSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getRange: (range: GenomeRange) => ?{[key:string]: string};
  getRangeAsString: (range: GenomeRange) => string;
  contigList: () => string[];
  normalizeRange: (range: GenomeRange) => Q.Promise<GenomeRange>;
  on: (event: string, handler: Function) => void;
  once: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}

// Expand range to begin and end on multiples of BASE_PAIRS_PER_FETCH.
function expandRange(range) {
  var roundDown = x => x - x % BASE_PAIRS_PER_FETCH;
  var newStart = Math.max(0, roundDown(range.start())),
      newStop = roundDown(range.stop() + BASE_PAIRS_PER_FETCH - 1);

  return new ContigInterval(range.contig, newStart, newStop);
}


var createFromTwoBitFile = function(remoteSource: TwoBit): TwoBitSource {
  // Local cache of genomic data.
  var contigList = [];
  var basePairs = {};  // contig -> locus -> letter

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function getBasePair(contig: string, position: number) {
    return (basePairs[contig] && basePairs[contig][position]) || null;
  }
  function setBasePair(contig: string, position: number, letter: string) {
    if (!basePairs[contig]) basePairs[contig] = {};
    basePairs[contig][position] = letter;
  }

  function fetch(range: ContigInterval) {
    var span = range.stop() - range.start();
    if (span > MAX_BASE_PAIRS_TO_FETCH) {
      return Q.when();  // empty promise
    }

    range = expandRange(range);

    console.log(`Fetching ${span} base pairs`);
    remoteSource.getFeaturesInRange(range.contig, range.start(), range.stop())
      .then(letters => {
        for (var i = 0; i < letters.length; i++) {
          setBasePair(range.contig, range.start() + i, letters[i]);
        }
        coveredRanges.push(range);
        coveredRanges = ContigInterval.coalesce(coveredRanges);
      })
      .then(() => {
        o.trigger('newdata', range);
      })
      .done();
  }

  // This either adds or removes a 'chr' as needed.
  function normalizeRangeSync(range: GenomeRange): GenomeRange {
    if (contigList.indexOf(range.contig) >= 0) {
      return range;
    }
    var altContig = utils.altContigName(range.contig);
    if (contigList.indexOf(altContig) >= 0) {
      return {
        contig: altContig,
        start: range.start,
        stop: range.stop
      };
    }
    return range;  // let it fail with the original contig
  }

  function normalizeRange(range: GenomeRange): Q.Promise<GenomeRange> {
    return contigPromise.then(() => normalizeRangeSync(range));
  }

  // Returns a {"chr12:123" -> "[ATCG]"} mapping for the range.
  function getRange(inputRange: GenomeRange) {
    if (!inputRange) return null;
    var range = normalizeRangeSync(inputRange);
    var span = range.stop - range.start;
    if (span > MAX_BASE_PAIRS_TO_FETCH) {
      return {};
    }
    return _.chain(_.range(range.start, range.stop + 1))
        .map(x => [inputRange.contig + ':' + x, getBasePair(range.contig, x)])
        .object()
        .value();
  }

  // Returns a string of base pairs for this range.
  function getRangeAsString(inputRange: GenomeRange): string {
    if (!inputRange) return '';
    var range = normalizeRangeSync(inputRange);
    return _.range(range.start, range.stop + 1)
        .map(x => getBasePair(range.contig, x) || '.')
        .join('');
  }

  // Fetch the contig list immediately.
  var contigPromise = remoteSource.getContigList().then(c => {
    contigList = c;
    o.trigger('contigs', contigList);
    return c;
  });
  contigPromise.done();

  var o = {
    // The range here is 0-based, inclusive
    rangeChanged: function(newRange: GenomeRange) {
      normalizeRange(newRange).then(r => {
        var range = new ContigInterval(r.contig, r.start, r.stop);

        // Check if this interval is already in the cache.
        if (range.isCoveredBy(coveredRanges)) {
          return;
        }

        fetch(range);
      }).done();
    },
    // The ranges passed to these methods are 0-based
    getRange,
    getRangeAsString,
    contigList: () => contigList,
    normalizeRange,

    // These are here to make Flow happy.
    on: () => {},
    once: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
};

function create(data: {url:string}): TwoBitSource {
  var url = data.url;
  if (!url) {
    throw new Error(`Missing URL from track: ${JSON.stringify(data)}`);
  }

  return createFromTwoBitFile(new TwoBit(new RemoteFile(url)));
}

module.exports = {
  create,
  createFromTwoBitFile
};

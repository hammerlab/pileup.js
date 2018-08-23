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

import Q from 'q';
import _ from 'underscore';
import {Events} from 'backbone';

import type {GenomeRange} from '../types';
import ContigInterval from '../ContigInterval';
import TwoBit from '../data/TwoBit';
import RemoteFile from '../RemoteFile';
import SequenceStore from '../SequenceStore';
import utils from '../utils';


// Requests for 2bit ranges are expanded to begin & end at multiples of this
// constant. Doing this means that panning typically won't require
// additional network requests.
var BASE_PAIRS_PER_FETCH = 10000;

var MAX_BASE_PAIRS_TO_FETCH = 100000;
var ZERO_BASED = true;



// Flow type for export.
export type TwoBitSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getRange: (range: GenomeRange) => {[key:string]: ?string};
  getRangeAsString: (range: GenomeRange) => string;
  contigList: () => string[];
  normalizeRange: (range: GenomeRange) => Q.Promise<GenomeRange>;
  on: (event: string, handler: Function) => void;
  once: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}


var createFromTwoBitFile = function(remoteSource: TwoBit): TwoBitSource {
  // Local cache of genomic data.
  var contigList = [];
  var store = new SequenceStore();

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges = ([]: ContigInterval<string>[]);

  function fetch(range: ContigInterval<string>) {
    var span = range.length();
    if (span > MAX_BASE_PAIRS_TO_FETCH) {
      //inform that we won't fetch the data
      o.trigger('newdatarefused', range);
      return Q.when();  // empty promise
    }
    //now we can add region to covered regions
    //doing it earlier would provide inconsistency
    coveredRanges.push(range);
    coveredRanges = ContigInterval.coalesce(coveredRanges);

    remoteSource.getFeaturesInRange(range.contig, range.start(), range.stop())
      .then(letters => {
        if (!letters) return;
        if (letters.length < range.length()) {
          // Probably at EOF
          range = new ContigInterval(range.contig,
                                     range.start(),
                                     range.start() + letters.length - 1);
        }
        store.setRange(range, letters);
      }).then(() => {
        o.trigger('newdata', range);
      }).done();
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
  function getRange(range: GenomeRange) {
    return store.getAsObjects(ContigInterval.fromGenomeRange(range));
  }

  // Returns a string of base pairs for this range.
  function getRangeAsString(range: GenomeRange): string {
    if (!range) return '';
    return store.getAsString(ContigInterval.fromGenomeRange(range));
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

        range = range.round(BASE_PAIRS_PER_FETCH, ZERO_BASED);
        var newRanges = range.complementIntervals(coveredRanges);

        for (var newRange of newRanges) {
          fetch(newRange);
        }
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
    trigger: (status: string, param: any) => {}
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

// Getter/setter for base pairs per fetch.
// This should only be used for testing.
function testBasePairsToFetch(num?: number): any {
  if (num) {
    BASE_PAIRS_PER_FETCH = num;
  } else {
    return BASE_PAIRS_PER_FETCH;
  }
}

module.exports = {
  create,
  createFromTwoBitFile,
  testBasePairsToFetch
};

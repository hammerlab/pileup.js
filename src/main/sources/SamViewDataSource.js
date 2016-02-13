/* @flow */
'use strict';

import _ from 'underscore';
import Q from 'q';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';
import SamRead from '../data/SamRead';
import type {Alignment, AlignmentDataSource} from '../Alignment';

// Genome ranges are rounded to multiples of this for fetching.
// This reduces network activity while fetching.
// TODO: tune this value
var BASE_PAIRS_PER_FETCH = 10;

function expandRange(range: ContigInterval<string>) {
  var roundDown = x => x - x % BASE_PAIRS_PER_FETCH;
  var newStart = Math.max(1, roundDown(range.start())),
      newStop = roundDown(range.stop() + BASE_PAIRS_PER_FETCH - 1);

  return new ContigInterval(range.contig, newStart, newStop);
}


type SamSpec = {
  url: string;
}

function create(spec: SamSpec): AlignmentDataSource {
  var url_template = spec.url;
  if (!url_template) {
    throw new Error(`Missing URL from track data: ${JSON.stringify(spec)}`);
  }

  var reads: {[key:string]: Alignment} = {};

  // Mapping from contig name to canonical contig name.
  var contigNames: {[key:string]: string} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addRead(read: Alignment) {
    var key = read.getKey();
    if (!reads[key]) {
      reads[key] = read;
    }
  }


  function fetch(range: GenomeRange) {
    var refsPromise = Q.when();
    var deferred = Q.defer();

    return refsPromise.then(() => {
      var url = url_template.replace(/<range>/, range.contig + ':' + range.start + '-' + range.stop);
      var contigName = range.contig;
      var interval = new ContigInterval(contigName, range.start, range.stop);

      // Check if this interval is already in the cache.
      // If not, immediately "cover" it to prevent duplicate requests.
      if (interval.isCoveredBy(coveredRanges)) {
        console.log('covered');
        return Q.when();
      }

      interval = expandRange(interval);
      var newRanges = interval.complementIntervals(coveredRanges);
      coveredRanges.push(interval);
      coveredRanges = ContigInterval.coalesce(coveredRanges);

      return Q.all(newRanges.map(range => {
        console.log('fetch url:', url);
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        o.trigger('networkprogress', {
          status: 'samtools view via reads.cgi'
        });
        request.onreadystatechange = function () {
          if (request.readyState === 4) {
            if (request.status === 200) {
              var lines = request.responseText.split('\n');
              for (var i = 1; i < lines.length; i++) {
                if (lines[i]) {
                  addRead(new SamRead(lines[i]));
                }
              }
              deferred.resolve(request.responseText);
              o.trigger('networkdone');
              //o.trigger('newdata', new ContigInterval(range.contig, range.start, range.stop));
              o.trigger('newdata', range);
            } else {
              deferred.reject("HTTP " + request.status + " for " + url);
            }
          }
        };
        request.send();
        return deferred.promise;
      }));
    });
  }

  /*
  function getAlignmentsInRange() {
    return _.filter(reads, read => true);
  }
  */
  function getAlignmentsInRange(range: ContigInterval<string>): Alignment[] {
    if (!range) return [];
    return _.filter(reads, read => read.intersects(range));
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange).done();
    },
    getAlignmentsInRange,

    // These are here to make Flow happy.
    on: () => {},
    once: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
}


module.exports = {
  create
};

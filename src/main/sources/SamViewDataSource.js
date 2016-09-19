/*global pileup */
/* jshint loopfunc: true */

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

var samHeader = {
  references: [],
  numeric_contigs: true
};

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
  var contigIndex: {[key:string]: number} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addRead(read: Alignment) {
    var key = read.getKey();
    if (!reads[key]) {
      reads[key] = read;
    }
  }

  function saveContigMapping(header: Object) {
    header.references.forEach((ref, i) => {
      var name = ref.SN;
      contigNames[name] = name;
      contigNames['chr' + name] = name;
      contigIndex[name] = i;
      contigIndex['chr' + name] = i;
      if (name.slice(0, 3) == 'chr') {
        contigNames[name.slice(3)] = name;
        contigIndex[name.slice(3)] = i;
      }
    });
    pileup.contigNames = contigNames;
    pileup.contigIndex = contigIndex;
  }

  function fetchHeader() {
    var refsPromise = Q.when();
    var deferred = Q.defer();

    return refsPromise.then(() => {
      var url = url_template;
      url = url.replace(/<numeric contigs>/, '');
      url = url.replace(/reads.cgi/, 'header.cgi');

      var request = new XMLHttpRequest();
      request.open("GET", url, true);
      o.trigger('networkprogress', {
        status: 'samtools view -H via header.cgi'
      });
      request.onreadystatechange = function () {
        if (request.readyState === 4) {
          if (request.status === 200) {
            var lines = request.responseText.split('\n');
            for (var i = 0; i < lines.length; i++) {
              if (lines[i] && lines[i].match(/^@SQ/)) {
                var fields = lines[i].split(/\t/);
                var attr = {};
                fields.shift();
                fields.forEach(kv => {
                  var p = kv.split(':');
                  var k = p.shift();
                  attr[k] = p.join(':');
                  if (k === 'SN' && attr[k].match(/[^0-9]/)) {
                    samHeader.numeric_contigs = false;
                  }
                });
                samHeader.references.push(attr);
              }
            }

            // The header can be called twice: once by the coverage track and the second time by the pileup track.
            if (_.isEmpty(contigNames)) {
              saveContigMapping(samHeader);
            }
            console.log('read ' + lines.length + ' header lines');
            deferred.resolve(request.responseText);
          }
          else if (request.status === 201) {
            o.trigger('networkerror', {
              error: true,
              status: 'error in header.cgi',
              message: request.responseText
            });
          }
          else {
            deferred.reject("HTTP " + request.status + " for " + url);
          }
        }
      };
      request.send();

      return deferred.promise;
    });
  }

  function fetch(range: GenomeRange) {
    var refsPromise = Q.when();
    var deferred = Q.defer();

    return refsPromise.then(() => {
      var url = url_template.replace(/<range>/, range.contig + ':' + range.start + '-' + range.stop);
      if (samHeader.numeric_contigs) {
        url = url.replace(/<numeric contigs>/, '');
      }
      else {
        url = url.replace(/<numeric contigs>/, 'nc;');
      }
      var contigName = contigNames[range.contig];
      var interval = new ContigInterval(contigName, range.start, range.stop);

      // Check if this interval is already in the cache.
      // If not, immediately "cover" it to prevent duplicate requests.
      if (interval.isCoveredBy(coveredRanges)) {
        return Q.when();
      }

      interval = expandRange(interval);
      var newRanges = interval.complementIntervals(coveredRanges);
      coveredRanges.push(interval);
      coveredRanges = ContigInterval.coalesce(coveredRanges);

      return Q.all(newRanges.map(range => {
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        o.trigger('networkprogress', {
          status: 'samtools view via reads.cgi'
        });
        request.onreadystatechange = function () {
          if (request.readyState === 4) {
            if (request.status === 200) {
              var lines = request.responseText.split('\n');
              for (var i = 0; i < lines.length; i++) {
                if (lines[i]) {
                  addRead(new SamRead(lines[i]));
                }
              }
              console.log('read ' + lines.length + ' reads');
              deferred.resolve(request.responseText);
              o.trigger('networkdone');
              o.trigger('newdata', range);
            }
            else if (request.status === 201) {
              o.trigger('networkerror', {
                error: true,
                status: 'error in reads.cgi',
                message: request.responseText
              });
            }
            else {
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
  function getAlignmentsInRange(range: ContigInterval<string>): Alignment[] {
    if (!range) return [];
    return _.filter(reads, read => read.intersects(range));
  }
  */

  function getAlignmentsInRange(range: ContigInterval<string>): Alignment[] {
    if (!range) return [];
    if (_.isEmpty(contigNames)) return [];

    var canonicalRange = new ContigInterval(
      contigNames[range.contig],
      range.start(), range.stop()
    );

    return _.filter(reads, read => read.intersects(canonicalRange));
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      if (_.isEmpty(contigNames)) {
        fetchHeader().then(() => {
          fetch(newRange).done();
        });
      }
      else {
        fetch(newRange).done();
      }
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

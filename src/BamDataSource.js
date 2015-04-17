/* @flow */
'use strict';

var Events = require('backbone').Events,
    _ = require('underscore'),
    Q = require('q');

import type * as BamFile from './bam';
import type * as SamRead from './SamRead';

var ContigInterval = require('./ContigInterval');

type BamDataSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getAlignmentsInRange: (range: ContigInterval<string>) => SamRead[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
};

// Genome ranges are rounded to multiples of this for fetching.
// This reduces network activity while fetching.
// TODO: tune this value
var BASE_PAIRS_PER_FETCH = 100;

function expandRange(range: ContigInterval<string>) {
  var roundDown = x => x - x % BASE_PAIRS_PER_FETCH;
  var newStart = Math.max(1, roundDown(range.start())),
      newStop = roundDown(range.stop() + BASE_PAIRS_PER_FETCH - 1);

  return new ContigInterval(range.contig, newStart, newStop);
}


function createBamSource(remoteSource: BamFile): BamDataSource {
  // Keys are virtualOffset.toString()
  var reads: {[key:string]: SamRead} = {};

  // Mapping from contig name to canonical contig name.
  var contigNames: {[key:string]: string} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: ContigInterval<string>[] = [];

  function addRead(read: SamRead) {
    var key = read.offset.toString();
    if (!reads[key]) {
      reads[key] = read;
    }
  }

  function fetch(range: GenomeRange) {
    var refsPromise;
    if (!_.isEmpty(contigNames)) {
      refsPromise = Q.when();
    } else {
      refsPromise = remoteSource.header.then(header => {
        header.references.forEach(ref => {
          var name = ref.name;
          contigNames[name] = name;
          contigNames['chr' + name] = name;
          if (name.slice(0, 3) == 'chr') {
            contigNames[name.slice(3)] = name;
          }
        });
      });
    }

    return refsPromise.then(() => {
      var contigName = contigNames[range.contig];
      var interval = new ContigInterval(contigName, range.start, range.stop);

      // Check if this interval is already in the cache.
      if (interval.isCoveredBy(coveredRanges)) {
        return Q.when();
      }

      interval = expandRange(interval);
      return remoteSource.getAlignmentsInRange(interval).then(reads => {
        coveredRanges.push(interval);
        coveredRanges = ContigInterval.coalesce(coveredRanges);
        reads.forEach(read => addRead(read));
      });
    });
  }

  function getAlignmentsInRange(range: ContigInterval<string>): SamRead[] {
    if (!range) return [];
    if (_.isEmpty(contigNames)) return [];

    var canonicalRange = new ContigInterval(contigNames[range.contig],
                                            range.start(), range.stop());

    return _.filter(reads, read => read.intersects(canonicalRange));
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange)
          .then(() => o.trigger('newdata', newRange))
          .done();
    },
    getAlignmentsInRange,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
}

module.exports = createBamSource;

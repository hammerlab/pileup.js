/* @flow */
'use strict';

var Events = require('backbone').Events,
    _ = require('underscore'),
    Q = require('q');

var ContigInterval = require('./ContigInterval'),
    BamFile = require('./bam'),
    RemoteFile = require('./RemoteFile');

import type {Alignment, AlignmentDataSource} from './Alignment';

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


function createFromBamFile(remoteSource: BamFile): AlignmentDataSource {
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

  function saveContigMapping(header: Object) {
    header.references.forEach(ref => {
      var name = ref.name;
      contigNames[name] = name;
      contigNames['chr' + name] = name;
      if (name.slice(0, 3) == 'chr') {
        contigNames[name.slice(3)] = name;
      }
    });
  }

  function fetch(range: GenomeRange) {
    var refsPromise = !_.isEmpty(contigNames) ? Q.when() : 
        remoteSource.header.then(saveContigMapping);

    // For BAMs without index chunks, we need to fetch the entire BAI file
    // before we can know how large the BAM header is. If the header is
    // pending, it's almost certainly because the BAI file is in flight.
    Q.when().then(() => {
      if (refsPromise.isPending() && !remoteSource.hasIndexChunks) {
        o.trigger('networkprogress', {
          status: 'Fetching BAM index -- use index chunks to speed this up'
        });
      }
    }).done();

    return refsPromise.then(() => {
      var contigName = contigNames[range.contig];
      var interval = new ContigInterval(contigName, range.start, range.stop);

      // Check if this interval is already in the cache.
      // If not, immediately "cover" it to prevent duplicate requests.
      if (interval.isCoveredBy(coveredRanges)) {
        return Q.when();
      }

      interval = expandRange(interval);
      coveredRanges.push(interval);
      coveredRanges = ContigInterval.coalesce(coveredRanges);

      return remoteSource.getAlignmentsInRange(interval)
        .progress(progressEvent => {
          o.trigger('networkprogress', progressEvent);
        })
        .then(reads => {
          reads.forEach(read => addRead(read));
          o.trigger('networkdone');
          o.trigger('newdata', interval);
        });
    });
  }

  function getAlignmentsInRange(range: ContigInterval<string>): Alignment[] {
    if (!range) return [];
    if (_.isEmpty(contigNames)) return [];

    var canonicalRange = new ContigInterval(contigNames[range.contig],
                                            range.start(), range.stop());

    return _.filter(reads, read => read.intersects(canonicalRange));
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange).done();
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

type BamSpec = {
  url: string;
  indexUrl: string;
  indexChunks?: Object;
}

function create(spec: BamSpec): AlignmentDataSource {
  var url = spec.url;
  if (!url) {
    throw new Error(`Missing URL from track data: ${JSON.stringify(spec)}`);
  }
  var indexUrl = spec.indexUrl;
  if (!indexUrl) {
    throw new Error(`Missing indexURL from track data: ${JSON.stringify(spec)}`);
  }

  // TODO: this is overly repetitive, see flow issue facebook/flow#437
  var bamFile = spec.indexChunks ?
      new BamFile(new RemoteFile(url), new RemoteFile(indexUrl), spec.indexChunks) :
      new BamFile(new RemoteFile(url), new RemoteFile(indexUrl));
  return createFromBamFile(bamFile);
}

module.exports = {
  create,
  createFromBamFile
};

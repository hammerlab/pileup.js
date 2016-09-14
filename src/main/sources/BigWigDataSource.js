/**
 * @flow
 */
'use strict';

import Q from 'q';
import _ from 'underscore';
import {Events} from 'backbone';

import BigWig from '../data/BigWig';
import ContigInterval from '../ContigInterval';

require("google-closure-library");
var RangeSet = goog.math.RangeSet;
var Range = goog.math.Range;

// Flow type for export.
export type BigWigSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  bucketingChanged: (newBuckets: number) => void;
  getValuesInRange: (range: ContigInterval<string>, basesPerBucket: number) => number[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}

function createFromBigWigFile(bigwig: BigWig): BigWigSource {
  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: {[key:number]: {string: RangeSet}} = {};

  function getValuesInRange(range: ContigInterval<string>, basesPerBucket: number): number[] {
    if (!range) return [];
    var results = [];
    var start = range.start();
    var end = range.end();
    for (var pos = start; pos < end; pos += basesPerBucket) {

    }
    // _.each(genes, gene => {
    //   if (range.intersects(gene.position)) {
    //     results.push(gene);
    //   }
    // });
    return results;
  }

  var basesPerBucket = 1;
  var maxBuckets = 100;
  function fetch(range: GenomeRange) {
    var interval = new ContigInterval(range.contig, range.start, range.stop);
    var r = new Range(range.start, range.end);

    var numBuckets = Math.min(maxBuckets, Math.floor(interval.length() / basesPerBucket));

    // Check if this interval is already in the cache.
    if (numBuckets in coveredRanges) {
      var bucketRanges = coveredRanges[numBuckets];
      if (range.contig in bucketRanges) {
        var rangeSet = bucketRanges[range.contig];
        if (rangeSet.contains(r)) {
          return Q.when();
        }
      } else {
        bucketRanges[range.contig] = new RangeSet();
      }
    } else {
      coveredRanges[numBuckets] = {};
      coveredRanges[numBuckets][range.contig] = new RangeSet();
    }

    coveredRanges[numBuckets][range.contig].add(r);
    
    return bigwig.getBuckets(interval, numBuckets).then(buckets => {
      o.trigger('newdata', interval);
    });
  }

  var o = {
    bucketingChanged: function(newBasesPerBucket: number) {
      basesPerBucket = newBasesPerBucket;
    },
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange).done();
    },
    getValuesInRange,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
}

function create(data: {url:string}): BigWigSource {
  var url = data.url;
  if (!url) {
    throw new Error(`Missing URL from track: ${JSON.stringify(data)}`);
  }

  return createFromBigWigFile(BigWig.load(url));
}

module.exports = {
  create,
  createFromBigWigFile
};

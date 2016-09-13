/* @flow */
'use strict';

import type {Strand} from '../Alignment';

import _ from 'underscore';
import Q from 'q';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';
import BigBed from '../data/BigBed';


var transcript_count;

export type Region = {
  position: ContigInterval<string>;
  name: string;  // human-readable name, e.g. "TP53"
}

// Flow type for export.
export type BigBedRegionSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getRegionsInRange: (range: ContigInterval<string>) => Region[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}

function parseBedFeature(f): Region {
  var name = f.rest;
  if (transcript_count[name]) {
    transcript_count[name] += 1;
  }
  else {
    transcript_count[name] = 1;
  }
  var position = new ContigInterval(f.contig, f.start, f.stop);
  return {
    position: position,
    name: name,
    id: name + ':' + transcript_count[name]
  };
}


function createFromBigBedFile(remoteSource: BigBed): BigBedRegionSource {
  // Collection of regions that have already been loaded.
  var regions: {[key:string]: Region} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: Array<ContigInterval<string>> = [];

  function addRegion(newRegion) {
    if (!regions[newRegion.id]) {
      regions[newRegion.id] = newRegion;
    }
  }

  function getRegionsInRange(range: ContigInterval<string>): Region[] {
    if (!range) return [];
    var results = [];
    _.each(regions, region => {
      if (range.intersects(region.position)) {
        results.push(region);
      }
    });
    return results;
  }

  function fetch(range: GenomeRange) {
    var interval = new ContigInterval(range.contig, range.start, range.stop);

    // Check if this interval is already in the cache.
    if (interval.isCoveredBy(coveredRanges)) {
      return Q.when();
    }

    coveredRanges.push(interval);
    coveredRanges = ContigInterval.coalesce(coveredRanges);

    return remoteSource.getFeatureBlocksOverlapping(interval).then(featureBlocks => {
      transcript_count = {};
      featureBlocks.forEach(fb => {
        coveredRanges.push(fb.range);
        coveredRanges = ContigInterval.coalesce(coveredRanges);
        var regions = fb.rows.map(parseBedFeature);
        regions.forEach(region => addRegion(region));
        o.trigger('newdata', interval);
      });
    });
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange).done();
    },
    getRegionsInRange,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
}

function create(data: {url:string}): BigBedRegionSource {
  var url = data.url;
  if (!url) {
    throw new Error(`Missing URL from track: ${JSON.stringify(data)}`);
  }

  return createFromBigBedFile(new BigBed(url));
}

module.exports = {
  create,
  createFromBigBedFile
};

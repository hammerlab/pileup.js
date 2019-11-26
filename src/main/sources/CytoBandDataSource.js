/**
 * The "glue" between cytoBand.js and IdiogramTrack.js.
 *
 * Allows loading remote gzipped cytoband files into an Idiogram visualization.
 *
 * @flow
 */
'use strict';

import _ from 'underscore';
import {Events} from 'backbone';

import ContigInterval from '../ContigInterval';
import Chromosome from '../data/chromosome';
import type {GenomeRange} from '../types';
import {CytoBandFile} from '../data/cytoBand';
import type {DataSource} from '../sources/DataSource';

import RemoteFile from '../RemoteFile';
import utils from '../utils';

var createFromCytoBandFile = function(remoteSource: CytoBandFile): DataSource<Chromosome> {
  // Local cache of genomic data.
  var contigMap: {[key:string]: Chromosome} = {};

  // This either adds or removes a 'chr' as needed.
  function normalizeRange(range: ContigInterval<string>): ContigInterval<string> {
    if (contigMap[range.contig] !== undefined) {
      return range;
    }
    var altContig = utils.altContigName(range.contig);
    if (contigMap[altContig] !== undefined) {
      return new ContigInterval(altContig, range.start(), range.stop());
    }
    return range;
  }

  function fetch(range: ContigInterval<string>) {
    remoteSource.getFeaturesInRange(range)
      .then(chr => {
        contigMap[chr.name] = chr;
      }).then(() => {
        o.trigger('newdata', range);
      }).done();
  }

  function getFeaturesInRange(range: ContigInterval<string>): Chromosome[] {
    return [contigMap[normalizeRange(range).contig]];
  }

  var o = {
    // The range here is 0-based, inclusive
    rangeChanged: function(newRange: GenomeRange) {
      // Check if this interval is already in the cache.
      if ( contigMap[newRange.contig] !== undefined ) {
        return;
      }
      fetch(new ContigInterval(newRange.contig, newRange.start, newRange.stop));
    },
    getFeaturesInRange,
    // These are here to make Flow happy.
    on: () => {},
    once: () => {},
    off: () => {},
    trigger: (status: string, param: any) => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
};

function create(url:string): DataSource<Chromosome> {
  if (!url) {
    throw new Error(`Missing URL from track: ${url}`);
  }
  return createFromCytoBandFile(new CytoBandFile(new RemoteFile(url)));
}


module.exports = {
  create,
  createFromCytoBandFile,
};

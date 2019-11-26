/**
 * Fetcher/parser for gzipped Cytoband files. Cytoband files can be downloaded
 * or accessed from http://hgdownload.cse.ucsc.edu/goldenpath for a genome build.
 *
 * extracts CONTIG, START, END, NAME and VALUE
 *
 * @flow
 */
'use strict';

import type AbstractFile from '../AbstractFile';
import type Q from 'q';
import _ from 'underscore';
import ContigInterval from '../ContigInterval';
import Chromosome from './chromosome';
import pako from 'pako/lib/inflate';  // for gzip inflation

function extractLine(cytoBandLine: string): Object {
  var split = cytoBandLine.split('\t');

  return {
          contig: split[0],
          band: {
              start: Number(split[1]),
              end:  Number(split[2]),
              name: split[3],
              value: split[4]
          }
        };
}

function groupedBandsToChromosome(grouped: Object[]): Chromosome {

  var bands = _.map(grouped, g => g.band);
  return new Chromosome(
    {name: grouped[0].contig,
    bands: bands,
    position: new ContigInterval(grouped[0].contig, bands[0].start, bands.slice(-1)[0].end)}
   );
}


class ImmediateCytoBandFile {
  chrs: {[key:string]:Chromosome};

  constructor(chrs: {[key:string]:Chromosome}) {
    this.chrs = chrs;
  }

  getFeaturesInRange(range: ContigInterval<string>): Chromosome {
    return this.chrs[range.contig];
  }
}

class CytoBandFile {
  remoteFile: AbstractFile;
  immediate: Q.Promise<ImmediateCytoBandFile>;

  constructor(remoteFile: AbstractFile) {
    this.remoteFile = remoteFile;

    this.immediate = this.remoteFile.getAll().then(bytes => {
      var txt = pako.inflate(bytes, {to: 'string'});
      var txtLines = _.filter(txt.split('\n'), i => i); // gets rid of empty lines
      var lines = txtLines.map(extractLine);
      return lines;
    }).then(lines => {
      // group bands by contig
      var grouped = _.groupBy(lines, l => l.contig);
      var chrs = _.mapObject(grouped, g => groupedBandsToChromosome(g));
      return new ImmediateCytoBandFile(chrs);
    });
    this.immediate.done();
  }

  getFeaturesInRange(range: ContigInterval<string>): Q.Promise<Chromosome[]> {
    return this.immediate.then(immediate => {
      return immediate.getFeaturesInRange(range);
    });
  }
}

module.exports = {
  CytoBandFile
};

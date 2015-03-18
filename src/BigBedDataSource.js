/* @flow */
'use strict';

var Events = require('backbone').Events,
    _ = require('underscore'),
    Q = require('q');


var ContigInterval = require('./ContigInterval'),
    Interval = require('./Interval');



type Gene = {
  position: ContigInterval;
  id: string;  // transcript ID, e.g. "ENST00000269305"
  strand: string;  // '+' or '-'
  codingRegion: Interval;  // locus of coding start
  exons: Array<Interval>;
  geneId: string;  // ensembl gene ID
  name: string;  // human-readable name, e.g. "TP53"
}

// TODO: move this into BigBed.js and get it to type check.
type BedRow = {
  // Half-open interval for the BED row.
  contig: string;
  start: number;
  stop: number;
  // Remaining fields in the BED row (typically tab-delimited)
  rest: string;
}

declare class BigBed {
  getFeaturesInRange: (contig: string, start: number, stop: number) => Q.Promise<Array<BedRow>>;
}


// Flow type for export.
type BigBedSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getGenesInRange: (range: ContigInterval) => Gene[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}

// The fields are described at http://genome.ucsc.edu/FAQ/FAQformat#format1
function parseBedFeature(f): Gene {
  var position = new ContigInterval(f.contig, f.start, f.stop),
      x = f.rest.split('\t'),
      exonLengths = x[7].split(',').map(Number),
      exonStarts = x[8].split(',').map(Number),
      exons = _.zip(exonStarts, exonLengths)
               .map(function([start, length]) {
                 return new Interval(f.start + start, f.start + start + length);
               });

  return {
    position,
    id: x[0],  // e.g. ENST00000359597
    strand: x[2],  // either + or -
    codingRegion: new Interval(Number(x[3]), Number(x[4])),
    geneId: x[9],
    name: x[10],
    exons
  };
}


function createBigBedDataSource(remoteSource: BigBed): BigBedSource {
  // Collection of genes that have already been loaded.
  var genes: Array<Gene> = [];
  window.genes = genes;

  function addGene(newGene) {
    if (!_.findWhere(genes, {id: newGene.id})) {
      genes.push(newGene);
    }
  }

  function getGenesInRange(range: ContigInterval): Gene[] {
    if (!range) return [];
    return genes.filter(gene => range.intersects(gene.position));
  }

  function fetch(range: GenomeRange) {
    // TODO: add an API for requesting the entire block of genes.
    return remoteSource.getFeaturesInRange(range.contig, range.start, range.stop)
        .then(features => {
          var genes = features.map(parseBedFeature);
          genes.forEach(gene => addGene(gene));
        });
  }

  var o = {
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange)
          .then(() => o.trigger('newdata', newRange))
          .done();
    },
    getGenesInRange,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
}

module.exports = createBigBedDataSource;

'use strict';

var Events = require('backbone').Events,
    _ = require('underscore');


var ContigInterval = require('./ContigInterval'),
    Interval = require('./Interval');


// TODO: move this into BigBed.js
type Gene = {
  position: ContigInterval;
  id: string;  // transcript ID, e.g. "ENST00000269305"
  strand: string;  // '+' or '-'
  codingStart: number;  // locus of coding start
  codingStop: number;
  exons: Array<Interval>;
  geneId: string;  // ensembl gene ID
  name: string;  // human-readable name, e.g. "TP53"
}

// The fields are described at http://genome.ucsc.edu/FAQ/FAQformat#format1
function parseBedFeature(f): Gene {
  var position = new ContigInterval(f.contig, f.start, f.stop),
      x = f.rest.split('\t'),
      exonLengths = x[7].split(',').map(Number),
      exonStarts = x[8].split(',').map(Number),
      exons = _.zip(exonStarts, exonLengths)
               .map(function([start, length]) {
                 return new Interval(start, start + length);
               });

  return {
    position,
    id: x[0],  // e.g. ENST00000359597
    strand: x[2],  // either + or -
    codingStart: Number(x[3]),
    codingStop: Number(x[4]),
    geneId: x[9],
    name: x[10],
    exons
  };
}


function createBigBedDataSource(remoteSource: BigBed) {
  // Collection of genes that have already been loaded.
  var genes: Array<Gene> = [];
  window.genes = genes;

  function addGene(newGene) {
    if (!_.findWhere(genes, {id: newGene.id})) {
      genes.push(newGene);
    }
  }

  function getGenesInRange(range: ContigInterval) {
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
    getGenesInRange
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
}

module.exports = createBigBedDataSource;

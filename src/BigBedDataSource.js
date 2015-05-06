/* @flow */
'use strict';

var Events = require('backbone').Events,
    _ = require('underscore'),
    Q = require('q');


var ContigInterval = require('./ContigInterval'),
    Interval = require('./Interval'),
    BigBed = require('./BigBed');


type Gene = {
  position: ContigInterval<string>;
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
type BedBlock = {
  range: ContigInterval<string>;
  rows: BedRow[];
}

// Flow type for export.
type BigBedSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getGenesInRange: (range: ContigInterval<string>) => Gene[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}

// The fields are described at http://genome.ucsc.edu/FAQ/FAQformat#format1
function parseBedFeature(f): Gene {
  var position = new ContigInterval(f.contig, f.start, f.stop),
      x = f.rest.split('\t'),
      // exons arrays sometimes have trailing commas
      exonLengths = x[7].replace(/,*$/, '').split(',').map(Number),
      exonStarts = x[8].replace(/,*$/, '').split(',').map(Number),
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


function createFromBigBedFile(remoteSource: BigBed): BigBedSource {
  // Collection of genes that have already been loaded.
  var genes: {[key:string]: Gene} = {};

  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: Array<ContigInterval<string>> = [];

  function addGene(newGene) {
    if (!genes[newGene.id]) {
      genes[newGene.id] = newGene;
    }
  }

  function getGenesInRange(range: ContigInterval<string>): Gene[] {
    if (!range) return [];
    var results = [];
    _.each(genes, gene => {
      if (range.intersects(gene.position)) {
        results.push(gene);
      }
    });
    return results;
  }

  function fetch(range: GenomeRange) {
    var interval = new ContigInterval(range.contig, range.start, range.stop);

    // Check if this interval is already in the cache.
    // XXX is this broken? should be r.contains(interval), no?
    if (_.any(coveredRanges, r => r.intersects(interval))) {
      return Q.when();
    }

    return remoteSource.getFeatureBlocksOverlapping(interval).then(featureBlocks => {
      featureBlocks.forEach(fb => {
        coveredRanges.push(fb.range);
        var genes = fb.rows.map(parseBedFeature);
        genes.forEach(gene => addGene(gene));
      });
    });
  }

  var o = {
    // TODO: only fire newdata when new data arrives
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

function create(data: {url:string}): BigBedSource {
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

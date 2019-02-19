/**
 * Class for parsing genes.
 * @flow
 */
'use strict';

import ContigInterval from '../ContigInterval';
import Interval from '../Interval';

import type {Strand} from '../Alignment';
import  {ga4ghStrandToStrand} from  '../Alignment';

import _ from 'underscore';

class Gene {
  position: ContigInterval<string>;
  id: string;  // transcript ID, e.g. "ENST00000269305"
  score: number;
  strand: Strand;
  codingRegion: Interval;  // locus of coding start
  exons: Array<Interval>;
  geneId: string;  // ensembl gene ID
  name: string;  // human-readable name, e.g. "TP53"

  constructor(gene: Object) {
    this.position = gene.position;
    this.id =  gene.id;
    this.score = gene.score;
    this.strand = gene.strand;
    this.codingRegion = gene.codingRegion;
    this.exons = gene.exons;
    this.geneId = gene.geneId;
    this.name = gene.name;
  }

  getKey(): string {
    return this.id;
  }

  getInterval(): ContigInterval<string> {
    return this.position;
  }

  static fromGA4GH(ga4ghGene: Object): Gene {
    var position = new ContigInterval(ga4ghGene.referenceName, parseInt(ga4ghGene.start), parseInt(ga4ghGene.end));
    var strand = ga4ghStrandToStrand(ga4ghGene.strand);

    // make a unique id for this Gene
    var id = ga4ghGene.id && ga4ghGene.id != "" ? ga4ghGene.id : (ga4ghGene.geneSymbol && ga4ghGene.geneSymbol != "" ? ga4ghGene.geneSymbol : ga4ghGene.name);

    var blockStarts = ga4ghGene.attributes.attr.blockStarts;
    var blockSizes = ga4ghGene.attributes.attr.blockSizes;

    // process exons, if available
    var  exons = [];

    if (blockStarts && blockSizes) {
      if (blockStarts.values && blockSizes.values) {
        var exonStarts = _.map(blockStarts.values[0].stringValue.split(','), f => parseInt(f));
        var exonLengths = _.map(blockSizes.values[0].stringValue.split(','), f => parseInt(f));

        exons = _.zip(exonStarts, exonLengths)
                 .map(function([start, length]) {
                   return new Interval(position.start() + start, position.start() + start + length);
                 });
      }
    }

    var thickStart = ga4ghGene.attributes.attr.thickStart;
    var thickEnd = ga4ghGene.attributes.attr.thickEnd;

    var codingRegion = null;

    if (thickStart.values && thickEnd.values) {
      codingRegion = new Interval(parseInt(thickStart.values[0].stringValue),
          parseInt(thickEnd.values[0].stringValue));
    } else {
      codingRegion = new Interval(position.start(), position.end());
    }

    return new Gene({
      position: position,
      id: id,
      score: 1000,
      strand: strand,
      codingRegion: codingRegion,
      exons: exons,
      geneId: ga4ghGene.geneSymbol,
      name: ga4ghGene.name
    });
  }

  intersects(range: ContigInterval<string>): boolean {
    return range.intersects(this.position);
  }
}

module.exports = Gene;

/* @flow */
'use strict';

var pileup = require('./pileup');

var sources = [
  {
    viz: pileup.viz.genome(),
    isReference: true,
    data: pileup.formats.twoBit({
      url: '/hg19.2bit'
    })
  },
  {
    viz: pileup.viz.variants(),
    data: pileup.formats.vcf({
      url: '/test/data/snv.chr17.vcf'
    })
  },
  {
    viz: pileup.viz.genes(),
    data: pileup.formats.bigBed({
      url: '/ensGene.bb'
    })
  },
  {
    viz: pileup.viz.pileup(),
    data: pileup.formats.bam({
      url: '/test/data/synth3.normal.17.7500000-7515000.bam',
      indexUrl: '/test/data/synth3.normal.17.7500000-7515000.bam.bai'
    }),
    cssClass: 'normal'
  }
];


pileup.create('root', {
  range: {contig: 'chr17', start: 7512444, stop: 7512484},
  tracks: sources
});

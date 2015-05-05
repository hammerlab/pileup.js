/* @flow */
'use strict';

var pileup = require('./pileup');

var sources = [
  {
    viz: 'genome',
    isReference: true,
    data: {
      url: '/hg19.2bit'
    }
  },
  {
    viz: 'variants',
    data: {
      url: '/test/data/snv.chr17.vcf'
    }
  },
  {
    viz: 'genes',
    data: {
      url: '/ensGene.bb'
    }
  },
  {
    viz: 'pileup',
    data: {
      type: 'bam',
      url: '/test/data/synth3.normal.17.7500000-7515000.bam',
      indexUrl: '/test/data/synth3.normal.17.7500000-7515000.bam.bai'
    },
    cssClass: 'normal'
  }
];


pileup.create('root', {
  range: {contig: 'chr17', start: 7512444, stop: 7512484},
  tracks: sources
});

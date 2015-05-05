/* @flow */
'use strict';

var React = require('react'),
    ContigInterval = require('./ContigInterval'),
    TwoBit = require('./TwoBit'),
    BigBed = require('./BigBed'),
    RemoteFile = require('./RemoteFile'),
    Bam = require('./bam'),
    VcfFile = require('./vcf'),
    Root = require('./Root'),
    BamDataSource = require('./BamDataSource'),
    BigBedDataSource = require('./BigBedDataSource'),
    TwoBitDataSource = require('./TwoBitDataSource'),
    VcfDataSource = require('./VcfDataSource');

// var vcf = new VcfFile(new RemoteFile('/large.vcf'));

var genome = new TwoBit('/hg19.2bit');
var dataSource = TwoBitDataSource.create(genome);

var ensembl = new BigBed('/ensGene.bb');
var ensemblDataSource = BigBedDataSource.create(ensembl);

var bamURL = '/test/data/synth3.normal.17.7500000-7515000.bam';

var bamFile = new RemoteFile(bamURL),
    baiFile = new RemoteFile(bamURL + '.bai');

var bam = new Bam(bamFile, baiFile);
var bamSource = BamDataSource.create(bam);

var vcf = new VcfFile(new RemoteFile('/test/data/snv.chr17.vcf'));
var vcfSource = VcfDataSource.create(vcf);

React.render(<Root referenceSource={dataSource}
                   geneSource={ensemblDataSource}
                   bamSource={bamSource}
                   variantSource={vcfSource}
                   initialRange={{contig: "chr17", start: 7512444, stop: 7512484}} />,
             document.getElementById('root'));

window.ensembl = ensembl;
window.genome = genome;
window.bam = bam;
window.vcf = vcf;
window.ContigInterval = ContigInterval;

var sources = [
  {
    type: 'reference',
    data: {
      url: '/hg19.2bit'
    }
  },
  {
    type: 'variants',
    data: {
      url: '/test/data/snv.chr17.vcf'
    }
  },
  {
    type: 'genes',
    data: {
      url: '/ensGene.bb'
    }
  },
  {
    type: 'pileup',
    data: {
      url: '/test/data/synth3.normal.17.7500000-7515000.bam',
      indexUrl: '/test/data/synth3.normal.17.7500000-7515000.bam.bai'
    },
    cssClass: 'normal'
  }
];

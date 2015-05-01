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
    createTwoBitDataSource = require('./TwoBitDataSource'),
    createBigBedDataSource = require('./BigBedDataSource'),
    createBamDataSource = require('./BamDataSource');

// var vcf = new VcfFile(new RemoteFile('/large.vcf'));

var genome = new TwoBit('/hg19.2bit');
var dataSource = createTwoBitDataSource(genome);

var ensembl = new BigBed('/ensGene.bb');
var ensemblDataSource = createBigBedDataSource(ensembl);

var bamURL = '/test/data/synth3.normal.17.7500000-7515000.bam';

var bamFile = new RemoteFile(bamURL),
    baiFile = new RemoteFile(bamURL + '.bai');

var bam = new Bam(bamFile, baiFile);
var bamSource = createBamDataSource(bam);

var vcf = new VcfFile(new RemoteFile('/snv.vcf'));

React.render(<Root referenceSource={dataSource}
                   geneSource={ensemblDataSource}
                   bamSource={bamSource}
                   initialRange={{contig: "chr17", start: 7512444, stop: 7512484}} />,
             document.getElementById('root'));

window.ensembl = ensembl;
window.genome = genome;
window.bam = bam;
window.vcf = vcf;
window.ContigInterval = ContigInterval;

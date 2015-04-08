/* @flow */
'use strict';

var React = require('react'),
    ContigInterval = require('./ContigInterval'),
    TwoBit = require('./TwoBit'),
    BigBed = require('./BigBed'),
    RemoteFile = require('./RemoteFile'),
    Bam = require('./bam'),
    Root = require('./Root'),
    createTwoBitDataSource = require('./TwoBitDataSource'),
    createBigBedDataSource = require('./BigBedDataSource');

var genome = new TwoBit('/hg19.2bit');
var dataSource = createTwoBitDataSource(genome);

var ensembl = new BigBed('/ensGene.bb');
var ensemblDataSource = createBigBedDataSource(ensembl);

var bam = new Bam(new RemoteFile('/test/data/index_test.bam'),
                  new RemoteFile('/test/data/index_test.bam.bai'));

React.render(<Root referenceSource={dataSource}
                   geneSource={ensemblDataSource}
                   initialRange={{contig: "chr17", start: 7512444, stop: 7512484}} />,
             document.getElementById('root'));

window.ensembl = ensembl;
window.genome = genome;
window.bam = bam;
window.ContigInterval = ContigInterval;

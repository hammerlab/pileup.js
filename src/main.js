/* @flow */
'use strict';

var React = require('react'),
    TwoBit = require('./TwoBit'),
    BigBed = require('./BigBed'),
    Root = require('./Root'),
    createTwoBitDataSource = require('./TwoBitDataSource'),
    createBigBedDataSource = require('./BigBedDataSource');

var genome = new TwoBit('/hg19.2bit');
var dataSource = createTwoBitDataSource(genome);

var ensembl = new BigBed('/ensGene.bb');
var ensemblDataSource = createBigBedDataSource(ensembl);

React.render(<Root referenceSource={dataSource}
                   geneSource={ensemblDataSource} />,
             document.getElementById('root'));

window.ensembl = ensembl;
window.genome = genome;

/* @flow */
var React = require('react'),
    TwoBit = require('./TwoBit'),
    BigBed = require('./BigBed'),
    Root = require('./Root'),
    createTwoBitDataSource = require('./TwoBitDataSource');

var startMs = Date.now();
// var genome = new TwoBit('http://www.biodalliance.org/datasets/hg19.2bit');
var genome = new TwoBit('/hg19.2bit');
var dataSource = createTwoBitDataSource(genome);

genome.getFeaturesInRange('chr22', 19178140, 19178170).then(basePairs => {
  var endMs = Date.now();
  console.log('elapsed time (ms):', endMs - startMs);
  console.log(basePairs);
  if (basePairs != 'NTCACAGATCACCATACCATNTNNNGNNCNA') {
    throw 'Incorrect genomic data!';
  }
}).done();

// pre-load some data to allow network-free panning
genome.getFeaturesInRange('chr1', 123000, 124000).done();

var root = React.render(<Root referenceSource={dataSource} />,
                        document.getElementById('root'));

var ensembl = new BigBed('/ensGene.bb');

window.ensembl = ensembl;
window.genome = genome;

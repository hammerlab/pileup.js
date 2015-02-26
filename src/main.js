/* @flow */
var React = require('react'),
    TwoBit = require('./TwoBit'),
    Root = require('./Root');

var startMs = Date.now();
// var genome = new TwoBit('http://www.biodalliance.org/datasets/hg19.2bit');
var genome = new TwoBit('/hg19.2bit');

genome.getFeaturesInRange('chr22', 19178140, 19178170).then(basePairs => {
  var endMs = Date.now();
  console.log('elapsed time (ms):', endMs - startMs);
  console.log(basePairs);
  if (basePairs != 'NTCACAGATCACCATACCATNTNNNGNNCNA') {
    throw 'Incorrect genomic data!';
  }
}).done();

var root = React.render(<Root referenceSource={genome} />,
                        document.getElementById('root'));

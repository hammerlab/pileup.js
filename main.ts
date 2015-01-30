/// <reference path="2bit.ts" />

var startMs = Date.now();
var genome = new TwoBit('http://www.biodalliance.org/datasets/hg19.2bit');
genome.getFeaturesInRange('chr22', 19178140, 19178170).then(basePairs => {
  var endMs = Date.now();
  console.log('elapsed time (ms):', endMs - startMs);
  if (basePairs != 'NTCACAGATCACCATACCATNTNNNGNNCNA') {
    throw 'Incorrect genomic data!';
  }
}).done();

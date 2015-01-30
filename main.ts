/// <reference path="2bit.ts" />

var genome = new TwoBit('http://www.biodalliance.org/datasets/hg19.2bit');
genome.getFeaturesInRange('20', 1234567, 1234678).then(basePairs => {
  console.log('base pairs:', basePairs);
}).done();

/// <reference path="2bit.ts" />

var genome = new TwoBit('http://www.biodalliance.org/datasets/hg19.2bit');
genome.getFeaturesInRange('chr22', 19178140, 19178170).then(basePairs => {
  console.log('base pairs:', basePairs);
}).done();

// dalliance: 780278023
// me:        785072557


// offset of chr22 sequence record (matches)
// dalliance: 779840927
//        me: 779840927

// DNA offset from header (matches):
// dalliance: 437096
//        me: 437096

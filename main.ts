/// <reference path="2bit.ts" />

var genome = new TwoBit('http://www.biodalliance.org/datasets/hg19.2bit');
genome.fetchRange('20', 1234567, 2345678);

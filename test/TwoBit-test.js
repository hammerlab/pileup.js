/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var TwoBit = require('../src/TwoBit');

describe('TwoBit', function() {
  function getTestTwoBit() {
    return new TwoBit('/test/data/test.2bit');   // See test/data/README.md
  }

  it('should have the right contigs', function() {
    var twoBit = getTestTwoBit();
    return twoBit.getContigList()
        .then(contigs => {
          expect(contigs).to.deep.equal(['chr1', 'chr17', 'chr22']);
        });
  });

  it('should extract unknowns', function() {
    // This test mirrors dalliance's (chr22:19178140-19178170)
    var twoBit = getTestTwoBit();
    return twoBit.getFeaturesInRange('chr22', 1, 31)
        .then(basePairs => {
          expect(basePairs).to.equal('NTCACAGATCACCATACCATNTNNNGNNCNA');
        });
  });

  it('should reject invalid contigs', function() {
    var twoBit = getTestTwoBit();
    return twoBit.getFeaturesInRange('chrZ', 12, 34)
          .then(() => { assert.fail('Should have thrown'); })
          .catch(err => {
            expect(err).to.match(/Invalid contig/);
          });
  });

  // TODO: masked regions
});

var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var TwoBit = require('../src/TwoBit');

describe('TwoBit', function() {
  function getTestTwoBit() {
    // This file was generated using UCSC tools:
    // twoBitToFa -seqList=./test/seqList.txt hg19.2bit /tmp/extract.fa
    // perl -i -pe 's/:.*//' /tmp/extract.fa
    // faToTwoBit /tmp/extract.fa test/data/test.2bit
    return new TwoBit('/test/data/test.2bit');
  }

  it('should have the right contigs', function(done) {
    var twoBit = getTestTwoBit();
    twoBit.getContigList()
        .then(contigs => {
          expect(contigs).to.deep.equal(['chr1', 'chr17', 'chr22']);
          done();
        })
        .done();
  });

  it('should extract unknowns', function(done) {
    // This test mirrors dalliance's (chr22:19178140-19178170)
    var twoBit = getTestTwoBit();
    twoBit.getFeaturesInRange('chr22', 1, 31)
        .then(basePairs => {
          expect(basePairs).to.equal('NTCACAGATCACCATACCATNTNNNGNNCNA');
          done();
        })
        .done();
  });

  it('should reject invalid contigs', function(done) {
    var twoBit = getTestTwoBit();
    twoBit.getFeaturesInRange('chrZ')
          .then(() => { assert.fail('Should have thrown'); })
          .catch(err => {
            expect(err).to.match(/Invalid contig/);
          })
          .fin(done)
          .done();
  });

  // TODO: masked regions
});

var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var TwoBit = require('../src/TwoBit');
var createTwoBitDataSource = require('../src/TwoBitDataSource');

describe('TwoBitDataSource', function() {
  function getTestSource() {
    // See description of this file in TwoBit-test.js
    var tb = new TwoBit('/test/data/test.2bit');
    return createTwoBitDataSource(tb);
  }

  it('should fetch contigs', function(done) {
    var source = getTestSource();
    source.on('contigs', contigs => {
      expect(contigs).to.deep.equal(['chr1', 'chr17', 'chr22']);
      done();
    });
    source.needContigs();
  });

  it('should fetch base pairs', function(done) {
    var source = getTestSource();
    var range = {contig: 'chr22', start: 1, stop: 4};
    expect(source.getRange()).to.deep.equal({

    });
  });
});

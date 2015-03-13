// Things to test:
// - getFeatures which return no features
// - getFeatures which crosses a block boundary
// - getFeatures which crosses a contig boundary (not currently possible)

var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var BigBed = require('../src/BigBed');

describe('BigBed', function() {
  function getTestBigBed() {
    // This file was generated using UCSC tools:
    // cd kent/src/utils/bedToBigBed/tests; make
    // This file is compressed, little endian and contains autoSQL.
    return new BigBed('/test/data/itemRgb.bb');
  }

  it('should extract features in a range', function(done) {
    var bb = getTestBigBed();

    bb.getFeaturesInRange('chrX', 151077036, 151078532)
        .then(features => {
          // chrX	151077031	151078198	MID_BLUE	0	-	151077031	151078198	0,0,128
          // chrX	151078198	151079365	VIOLET_RED1	0	-	151078198	151079365	255,62,150
          expect(features).to.have.length(2);
          expect(features[0].contig).to.equal('chrX');
          expect(features[0].start).to.equal(151077031);
          expect(features[0].stop).to.equal(151078198);
          expect(features[1].contig).to.equal('chrX');
          expect(features[1].start).to.equal(151078198);
          expect(features[1].stop).to.equal(151079365);

          var rest0 = features[0].rest.split('\t');
          expect(rest0).to.have.length(6)
          expect(rest0[0]).to.equal('MID_BLUE');
          expect(rest0[2]).to.equal('-');
          expect(rest0[5]).to.equal('0,0,128');

          var rest1 = features[1].rest.split('\t');
          expect(rest1).to.have.length(6)
          expect(rest1[0]).to.equal('VIOLET_RED1');
          expect(rest1[2]).to.equal('-');
          expect(rest1[5]).to.equal('255,62,150');
          done();
        })
        .done();
  });
});

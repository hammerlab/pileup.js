/* @flow */
var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var BigBed = require('../src/BigBed'),
    createBigBedDataSource = require('../src/BigBedDataSource'),
    ContigInterval = require('../src/ContigInterval');

describe('BigBedDataSource', function() {
  function getTestSource() {
    // This file was created from Biodalliance's ensGene.bb via:
    // bigBedToBed ensGene.bb ensGene.bed
    // grep '^chr17   ' ensGene.bed > /tmp/ensGene17.bed
    // bedToBigBed -type=bed12+2 /tmp/ensGene17.bed <(echo "chr17 78774742")
    //             test/data/ensembl.chr17.bb
    return createBigBedDataSource(new BigBed('/test/data/ensembl.chr17.bb'));
  }

  it('should extract features in a range', function(done) {
    this.timeout(5000);
    var source = getTestSource();

    // No genes fetched initially
    var tp53range = new ContigInterval('chr17', 7512444, 7517300)
    var tp53 = source.getGenesInRange(tp53range);
    expect(tp53).to.deep.equal([]);

    // Fetching that one gene should cache its entire block.
    source.on('newdata', () => {
      var tp53s = source.getGenesInRange(tp53range);
      expect(tp53s).to.have.length(1);

      var tp53 = tp53s[0];
      expect(tp53.name).to.equal('TP53');
      expect(tp53.exons).to.have.length(11);
      done();
    });
    source.rangeChanged({
      contig: tp53range.contig,
      start: tp53range.start(),
      stop: tp53range.stop()
    });
  });
});

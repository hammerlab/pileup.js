/* @flow */
'use strict';

var expect = require('chai').expect;

var BigBed = require('../main/BigBed'),
    BigBedDataSource = require('../main/BigBedDataSource'),
    ContigInterval = require('../main/ContigInterval');

describe('BigBedDataSource', function() {
  function getTestSource() {
    // See test/data/README.md
    return BigBedDataSource.createFromBigBedFile(
        new BigBed('/test-data/ensembl.chr17.bb'));
  }

  it('should extract features in a range', function(done) {
    this.timeout(5000);
    var source = getTestSource();

    // No genes fetched initially
    var tp53range = new ContigInterval('chr17', 7512444, 7517300);
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

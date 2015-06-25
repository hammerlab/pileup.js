/* @flow */
'use strict';

var expect = require('chai').expect;

var VcfFile = require('../main/vcf'),
    VcfDataSource = require('../main/VcfDataSource'),
    ContigInterval = require('../main/ContigInterval'),
    RemoteFile = require('../main/RemoteFile');

describe('VcfDataSource', function() {
  function getTestSource() {
    var vcf = new VcfFile(new RemoteFile('/test-data/snv.vcf'));
    return VcfDataSource.createFromVcfFile(vcf);
  }

  it('should extract features in a range', function(done) {
    var source = getTestSource();
    var range = new ContigInterval('20', 63799, 69094);

    // No variants are cached yet.
    var variants = source.getFeaturesInRange(range);
    expect(variants).to.deep.equal([]);

    source.on('newdata', () => {
      var variants = source.getFeaturesInRange(range);
      expect(variants).to.have.length(6);
      expect(variants[0].contig).to.equal('20');
      expect(variants[0].position).to.equal(63799);
      expect(variants[0].ref).to.equal('C');
      expect(variants[0].alt).to.equal('T');
      done();
    });
    source.rangeChanged({
      contig: range.contig,
      start: range.start(),
      stop: range.stop()
    });
  });
});

/* @flow */
'use strict';

var expect = require('chai').expect;

var VcfFile = require('../main/vcf'),
    ContigInterval = require('../main/ContigInterval'),
    RemoteFile = require('../main/RemoteFile');

describe('VCF', function() {
  it('should respond to queries', function() {
    var vcf = new VcfFile(new RemoteFile('/test-data/snv.vcf'));
    var range = new ContigInterval('20', 63799, 69094);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features).to.have.length(6);

      var v0 = features[0],
          v5 = features[5];

      expect(v0.contig).to.equal('20');
      expect(v0.position).to.equal(63799);
      expect(v0.ref).to.equal('C');
      expect(v0.alt).to.equal('T');

      expect(v5.contig).to.equal('20');
      expect(v5.position).to.equal(69094);
      expect(v5.ref).to.equal('G');
      expect(v5.alt).to.equal('A');
    });
  });

  it('should add chr', function() {
    var vcf = new VcfFile(new RemoteFile('/test-data/snv.vcf'));
    var range = new ContigInterval('chr20', 63799, 69094);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features).to.have.length(6);
      expect(features[0].contig).to.equal('20');  // not chr20
      expect(features[5].contig).to.equal('20');
    });
  });

  it('should handle unsorted VCFs', function() {
    var vcf = new VcfFile(new RemoteFile('/test-data/sort-bug.vcf'));
    var chr1 = new ContigInterval('chr1', 1, 1234567890),  // all of chr1
        chr5 = new ContigInterval('chr5', 1, 1234567890);
    return vcf.getFeaturesInRange(chr1).then(features => {
      expect(features).to.have.length(5);
      return vcf.getFeaturesInRange(chr5);
    }).then(features => {
      expect(features).to.have.length(5);
    });
  });
});

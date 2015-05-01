/* @flow */
'use strict';

var expect = require('chai').expect;

var VcfFile = require('../src/vcf'),
    ContigInterval = require('../src/ContigInterval'),
    RemoteFile = require('../src/RemoteFile');

describe('VCF', function() {
  it('should respond to queries', function() {
    var vcf = new VcfFile(new RemoteFile('/test/data/snv.vcf'));
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
});

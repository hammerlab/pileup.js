/* @flow */
'use strict';

import {expect} from 'chai';

import VcfFile from '../../main/data/vcf';
import ContigInterval from '../../main/ContigInterval';
import RemoteFile from '../../main/RemoteFile';
import LocalStringFile from '../../main/LocalStringFile';

describe('VCF', function() {
  describe('should respond to queries', function() {
    var testQueries = (vcf) => {
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
    };

    var remoteFile = new RemoteFile('/test-data/snv.vcf');

    it('remote file', function() {
      var vcf = new VcfFile(remoteFile);
      testQueries(vcf);
    });

    it('local file from string', function() {
      return remoteFile.getAllString().then(content => {
        var localFile = new LocalStringFile(content);
        var vcf = new VcfFile(localFile);
        testQueries(vcf);
      });
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

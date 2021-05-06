/* @flow */
'use strict';

import {expect} from 'chai';

import {VcfFile, VcfWithTabixFile} from '../../main/data/vcf';
import ContigInterval from '../../main/ContigInterval';
import RemoteFile from '../../main/RemoteFile';
import LocalStringFile from '../../main/LocalStringFile';

describe('VCF', function() {
  describe('should respond to queries', function(): any {
    var testQueries = (vcf) => {
      var range = new ContigInterval('20', 63799, 69094);
      return vcf.getFeaturesInRange(range).then(features => {
        expect(features).to.have.length(6);

        var v0 = features[0].variant;

        var v5 = features[5].variant;

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

    it('remote file', function(done) {
      var vcf = new VcfFile(remoteFile);
      testQueries(vcf);
      done();
    });

    it('local file from string', function(): any {
      return remoteFile.getAllString().then(content => {
        var localFile = new LocalStringFile(content);
        var vcf = new VcfFile(localFile);
        testQueries(vcf);
      });
    });
  });

  it('should have frequency', function(): any {
    var vcf = new VcfFile(new RemoteFile('/test-data/allelFrequency.vcf'));
    var range = new ContigInterval('chr20', 61790, 61800);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features).to.have.length(1);
      expect(features[0].variant.contig).to.equal('20');
      expect(features[0].variant.majorFrequency).to.equal(0.7);
      expect(features[0].variant.minorFrequency).to.equal(0.7);
    });
  });

  it('should have highest frequency', function(): any {
    var vcf = new VcfFile(new RemoteFile('/test-data/allelFrequency.vcf'));
    var range = new ContigInterval('chr20', 61730, 61740);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features).to.have.length(1);
      expect(features[0].variant.contig).to.equal('20');
      expect(features[0].variant.majorFrequency).to.equal(0.6);
      expect(features[0].variant.minorFrequency).to.equal(0.3);
    });
  });

  it('should add chr', function(): any {
    var vcf = new VcfFile(new RemoteFile('/test-data/snv.vcf'));
    var range = new ContigInterval('chr20', 63799, 69094);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features).to.have.length(6);
      expect(features[0].variant.contig).to.equal('20'); // not chr20
      expect(features[5].variant.contig).to.equal('20');
    });
  });

  it('should handle unsorted VCFs', function(): any {
    var vcf = new VcfFile(new RemoteFile('/test-data/sort-bug.vcf'));
    var chr1 = new ContigInterval('chr1', 1, 1234567890);
    // all of chr1

    var chr5 = new ContigInterval('chr5', 1, 1234567890);
    return vcf.getFeaturesInRange(chr1).then(features => {
      expect(features).to.have.length(5);
      return vcf.getFeaturesInRange(chr5);
    }).then(features => {
      expect(features).to.have.length(5);
    });
  });

  it('should get samples', function(): any {
    var vcf = new VcfFile(new RemoteFile('/test-data/sort-bug.vcf'));

    return vcf.getCallNames().then(samples => {
      expect(samples).to.have.length(2);
    });
  });

  it('should get genotypes', function(): any {
    var vcf = new VcfFile(new RemoteFile('/test-data/snv.vcf'));
    var range = new ContigInterval('chr20', 63799, 69094);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features[0].calls).to.have.length(2);
      expect(features[0].calls[0].genotype).to.deep.equal([0,1]);
      expect(features[0].calls[0].callSetName).to.equal("NORMAL");

      expect(features[0].calls[1].genotype).to.deep.equal([0,1]);
      expect(features[0].calls[1].callSetName).to.equal("TUMOR");
    });
  });

});

describe('VCF with tabix index', function() {
  it('should get sample names', function(): any {
    var vcf = new VcfWithTabixFile('/test-data/snv.vcf.gz','/test-data/snv.vcf.gz.tbi');

    return vcf.getCallNames().then(samples => {
      expect(samples).to.have.length(2);
    });
  });

  it('should get genotypes', function(): any {
    var vcf = new VcfWithTabixFile('/test-data/snv.vcf.gz','/test-data/snv.vcf.gz.tbi');
    var range = new ContigInterval('chr20', 63799, 69094);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features[0].calls).to.have.length(2);
      expect(features[0].calls[0].genotype).to.deep.equal([0,1]);
      expect(features[0].calls[0].callSetName).to.equal("NORMAL");

      expect(features[0].calls[1].genotype).to.deep.equal([0,1]);
      expect(features[0].calls[1].callSetName).to.equal("TUMOR");
    });
  });

});

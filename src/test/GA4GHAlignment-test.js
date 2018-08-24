/** @flow */
'use strict';

import {expect} from 'chai';

import GA4GHAlignment from '../main/GA4GHAlignment';
import RemoteFile from '../main/RemoteFile';
import Bam from '../main/data/bam';

describe('GA4GHAlignment', function() {
  var sampleAlignments = [];

  before(function(): any {
    return new RemoteFile('/test-data/alignments.ga4gh.1.10000-11000.json').getAllString().then(data => {
      sampleAlignments = JSON.parse(data).alignments;
    });
  });

  it('should read the sample alignments', function(done) {
    expect(sampleAlignments).to.have.length(100);
    done();
  });

  it('should provide basic accessors', function(done) {
    var a = new GA4GHAlignment(sampleAlignments[0]);
    expect(a.name).to.equal('ERR181329.21587964');
    expect(a.getSequence()).to.equal('ATAACCCTAACCATAACCCTAACCCTAACCCTAACCCTAACCCTAACCCTAACCCTAACCCTAACCCTAACCCTAACCCTAACCCTAACCCTAACCCTAA');
    expect(a.getQualityScores()).to.deep.equal([2, 36, 36, 37, 37, 38, 37, 39, 37, 38, 38, 38, 3, 38, 38, 39, 38, 39, 39, 39, 38, 39, 39, 38, 40, 40, 38, 39, 39, 39, 39, 40, 38, 40, 39, 40, 38, 38, 38, 39, 38, 40, 37, 40, 38, 39, 39, 40, 40, 40, 39, 32, 39, 35, 39, 36, 38, 40, 39, 39, 39, 36, 39, 37, 39, 40, 39, 31, 39, 35, 36, 39, 37, 32, 40, 41, 38, 38, 37, 32, 39, 38, 38, 39, 33, 36, 25, 37, 38, 19, 35, 13, 37, 31, 35, 33, 34, 8, 33, 18]);
    expect(a.getStrand()).to.equal('+');
    expect(a.getInterval().toString()).to.equal('1:9999-10098');  // 0-based
    expect(a.cigarOps).to.deep.equal([
      {op: 'M', length: 100}
    ]);
    expect(a.getMateProperties()).to.deep.equal({
      ref: '1',
      pos: 10007,
      strand: '-'
    });
    done();
  });

  it('should match SamRead', function(): any {
    var bam = new Bam(new RemoteFile('/test-data/chr17.1-250.bam'));
    var json = new RemoteFile('/test-data/alignments.ga4gh.chr17.1-250.json');

    json.getAllString().then(data => {
      var matchingBamAlignments = JSON.parse(data).alignments;

      return bam.readAll().then(({alignments: samReads}) => {
        // This is a workaround. See https://github.com/ga4gh/server/issues/488
        samReads.splice(-1, 1);

        expect(matchingBamAlignments.length).to.equal(samReads.length);
        for (var i = 0; i < matchingBamAlignments.length; i++) {
          var ga4gh = new GA4GHAlignment(matchingBamAlignments[i]),
              bam = samReads[i];
          expect(ga4gh.getSequence()).to.equal(bam.getSequence());
          var interval = ga4gh.getInterval();
          expect(interval.start()).to.equal(bam.pos);

          // See https://github.com/ga4gh/server/issues/491
          // expect(ga4gh.getStrand()).to.equal(bam.getStrand());
          // For the if statement, see https://github.com/ga4gh/server/issues/492
          var quality = ga4gh.getQualityScores();
          if (quality.length) {
            expect(quality).to.deep.equal(bam.getQualityScores());
          }
          expect(ga4gh.cigarOps).to.deep.equal(bam.cigarOps);
          // After ga4gh#491, change this to a .deep.equal on getMateProperties()
          var ga4ghMate = ga4gh.getMateProperties(),
              bamMate = bam.getMateProperties();
          expect(!!ga4ghMate).to.equal(!!bamMate);
          if (ga4ghMate && bamMate) {
            expect(ga4ghMate.ref).to.equal(bamMate.ref);
            expect(ga4ghMate.pos).to.equal(bamMate.pos);
          }
        }
      });
    });
  });
});

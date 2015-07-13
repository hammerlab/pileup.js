/** @flow */

var expect = require('chai').expect;

var GA4GHAlignment = require('../main/GA4GHAlignment'),
    RemoteFile = require('../main/RemoteFile'),
    SamRead = require('../main/SamRead'),
    Bam = require('../main/bam');

describe('GA4GHAlignment', function() {
  var sampleAlignments = [];

  before(function() {
    return new RemoteFile('/test-data/chr17.1-250.json').getAllString().then(data => {
      sampleAlignments = JSON.parse(data).alignments;
    });
  });

  it('should read the sample alignments', function() {
    expect(sampleAlignments).to.have.length(14);
  });

  it('should provide basic accessors', function() {
    var a = new GA4GHAlignment(sampleAlignments[0]);
    expect(a.getName()).to.equal('r000');
    expect(a.getSequence()).to.equal('ATTTAGCTAC');
    expect(a.getQualityScores()).to.deep.equal([32,32,32,32,32,32,32,32,32,32]);
    expect(a.getStrand()).to.equal('+');
    expect(a.getInterval().toString()).to.equal('chr17:4-13');  // 0-based
    expect(a.getCigarOps()).to.deep.equal([
      {op: 'M', length: 10}
    ]);
  });

  it('should match SamRead', function() {
    var bam = new Bam(new RemoteFile('/test-data/chr17.1-250.bam'));
    return bam.readAll().then(({alignments: samReads}) => {
      // This is a workaround. See https://github.com/ga4gh/server/issues/488
      samReads.splice(-1, 1);

      expect(sampleAlignments.length).to.equal(samReads.length);
      for (var i = 0; i < sampleAlignments.length; i++) {
        var ga4gh = new GA4GHAlignment(sampleAlignments[i]),
            bam = samReads[i];
        expect(ga4gh.getSequence()).to.equal(bam.getSequence());
        // See https://github.com/ga4gh/server/issues/491
        // expect(ga4gh.getStrand()).to.equal(bam.getStrand());
        // For the if statement, see https://github.com/ga4gh/server/issues/492
        var quality = ga4gh.getQualityScores();
        if (quality.length) {
          expect(quality).to.deep.equal(bam.getQualityScores());
        }
        expect(ga4gh.getCigarOps()).to.deep.equal(bam.getCigarOps());
      }
    });
  });
});

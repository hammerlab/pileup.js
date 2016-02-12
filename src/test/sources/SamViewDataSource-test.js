/* @flow */
'use strict';

import {expect} from 'chai';

import SamViewDataSource from '../../main/sources/SamViewDataSource';

describe('SamViewDataSource', function() {
  function getTestSource() {
    var url = "http://rnd10/~selkovjr/vcfcomp/interface/reads.cgi?coords=<range>;bam=/rhome/selkovjr/pipeline-NA12878/tmap-realign/out/328330:IonXpress_001_sorted.bam";
    return SamViewDataSource.create({'url': url});
  }

  it('should extract features in a range (ignoring the range)', function(done) {
    this.timeout(5000);
    var source = getTestSource();

    // This range matches the "large, dense" test in bam-test.js
    var reads = source.getAlignmentsInRange(); // ignore range
    expect(reads).to.deep.equal([]);

    source.on('newdata', () => {
      console.log('newdata');
      var reads = source.getAlignmentsInRange(); // range is ignored
      console.log(['reads', reads]);
      expect(reads).to.have.length(1112);
      expect(reads[0].toString()).to.equal('20:31511251-31511351');
      expect(reads[1111].toString()).to.equal('20:31514171-31514271');
      done();
    });
    source.rangeChanged({
      contig: range.contig,
      start: range.start(),
      stop: range.stop()
    });
  });
});

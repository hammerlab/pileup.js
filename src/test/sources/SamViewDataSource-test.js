/* @flow */
'use strict';

import {expect} from 'chai';

import ContigInterval from '../../main/ContigInterval';
import SamViewDataSource from '../../main/sources/SamViewDataSource';

describe('SamViewDataSource', function() {
  function getTestSource() {
    var url = "http://localhost:8082/scripts/reads.cgi?coords=<range>;bam=test-data/synth3.normal.17.7500000-7515000.bam";
    return SamViewDataSource.create({'url': url});
  }

  it('should extract features in a range (ignoring the range)', function(done) {
    this.timeout(5000);
    var source = getTestSource();

    var range = new ContigInterval('17', 7499910, 7499999);
    var reads = source.getAlignmentsInRange(range);
    expect(reads).to.deep.equal([]);

    source.on('newdata', () => {

      var reads = source.getAlignmentsInRange(range);
      expect(reads).to.have.length(51);
      expect(reads[0].toString()).to.equal('17:7499902-7500002');
      expect(reads[50].toString()).to.equal('17:7499998-7500098');
      done();
    });
    source.rangeChanged({
      contig: range.contig,
      start: range.start(),
      stop: range.stop()
    });
  });
});

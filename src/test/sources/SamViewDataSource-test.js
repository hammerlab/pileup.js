/* @flow */
'use strict';

import {expect} from 'chai';

import ContigInterval from '../../main/ContigInterval';
import SamViewDataSource from '../../main/sources/SamViewDataSource';

describe('SamViewDataSource', function() {
  function getTestSource() {
    var host = window.location.host.replace(/:\d+$/, '');
    var url = "http://" + host + ":8082/scripts/reads.cgi?coords=<range>;bam=test-data/synth3.normal.17.7500000-7515000.bam";
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
      expect(reads).to.have.length(52);
      expect(reads[0].toString()).to.equal('17:7499900-7500000');
      expect(reads[51].toString()).to.equal('17:7499997-7500097');
      done();
    });
    source.rangeChanged({
      contig: range.contig,
      start: range.start(),
      stop: range.stop()
    });
  });
});

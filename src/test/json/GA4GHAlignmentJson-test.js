/** @flow */
'use strict';

import {expect} from 'chai';

import ContigInterval from '../../main/ContigInterval';
import GA4GHAlignmentJson from '../../main/json/GA4GHAlignmentJson';
import RemoteFile from '../../main/RemoteFile';

describe('GA4GHAlignmentJson', function() {
  var json;

  before(function(): any {
    return new RemoteFile('/test-data/alignments.ga4gh.chr17.1-250.json').getAllString().then(data => {
      json = data;
    });
  });

  it('should filter alignments from json', function(done) {

    var source = GA4GHAlignmentJson.create(json);

    var requestInterval = new ContigInterval('chr17', 10, 20);

    var reads = source.getAlignmentsInRange(requestInterval);
    expect(reads).to.have.length(2);
    done();
    
  });

  it('should not fail on empty json string', function(done) {

    var source = GA4GHAlignmentJson.create("{}");

    var requestInterval = new ContigInterval('chr17', 10, 20);

    var reads = source.getAlignmentsInRange(requestInterval);
    expect(reads).to.have.length(0);
    done();

  });
});

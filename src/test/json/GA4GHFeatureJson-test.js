/** @flow */
'use strict';

import {expect} from 'chai';

import ContigInterval from '../../main/ContigInterval';
import GA4GHFeatureJson from '../../main/json/GA4GHFeatureJson';
import RemoteFile from '../../main/RemoteFile';

describe('GA4GHFeatureJson', function() {
  var json;

  before(function(): any {
    return new RemoteFile('/test-data/features.ga4gh.chr1.120000-125000.json').getAllString().then(data => {
      json = data;
    });
  });

  it('should filter features from json', function(done) {
    
    var source = GA4GHFeatureJson.create(json);

    var requestInterval = new ContigInterval('chr1', 130000, 135000);

    var features = source.getFeaturesInRange(requestInterval);
    expect(features).to.have.length(2);
    done();

  });

  it('should not fail on empty json string', function(done) {

    var source = GA4GHFeatureJson.create("{}");

    var requestInterval = new ContigInterval('chr17', 10, 20);

    var reads = source.getFeaturesInRange(requestInterval);
    expect(reads).to.have.length(0);
    done();

  });

});

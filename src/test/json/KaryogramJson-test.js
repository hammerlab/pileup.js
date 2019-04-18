/** @flow */
'use strict';

import {expect} from 'chai';

import ContigInterval from '../../main/ContigInterval';
import KaryogramJson from '../../main/json/KaryogramJson';
import RemoteFile from '../../main/RemoteFile';

describe('KaryogramJson', function() {
  var json;

  before(function(): any {
    return new RemoteFile('/test-data/basic-chromosomes.json').getAllString().then(data => {
      json = data;
    });
  });

  it('should filter features from json', function(done) {

    var source = KaryogramJson.create(json);

    var requestInterval = new ContigInterval('chr1', 130000, 135000);

    var features = source.getFeaturesInRange(requestInterval);
    expect(features).to.have.length(1); 
    done();

  });

  it('should not fail on empty json string', function(done) {

    var source = KaryogramJson.create("{}");

    var requestInterval = new ContigInterval('chr17', 10, 20);

    var chromosomes = source.getFeaturesInRange(requestInterval);
    expect(chromosomes).to.have.length(0);
    done();

  });

});

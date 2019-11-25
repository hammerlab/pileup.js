/** @flow */
'use strict';

import {expect} from 'chai';

import ContigInterval from '../../main/ContigInterval';
import IdiogramJson from '../../main/json/IdiogramJson';
import RemoteFile from '../../main/RemoteFile';

describe('IdiogramJson', function() {
  var json;

  before(function(): any {
    return new RemoteFile('/test-data/gstained_chromosomes_data.json').getAllString().then(data => {
      json = data;
    });
  });

  it('should filter features from json', function(done) {

    var source = IdiogramJson.create(json);

    var requestInterval = new ContigInterval('chr1', 130000, 135000);

    var features = source.getFeaturesInRange(requestInterval)[0];
    expect(features.bands).to.have.length(63);
    done();

  });

  it('should not fail on empty json string', function(done) {

    var source = IdiogramJson.create("{}");

    var requestInterval = new ContigInterval('chr17', 10, 20);

    var chromosomes = source.getFeaturesInRange(requestInterval);
    expect(chromosomes).to.have.length(0);
    done();

  });

});

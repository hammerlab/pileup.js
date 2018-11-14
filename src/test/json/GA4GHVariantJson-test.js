/** @flow */
'use strict';

import {expect} from 'chai';

import ContigInterval from '../../main/ContigInterval';
import GA4GHVariantJson from '../../main/json/GA4GHVariantJson';
import RemoteFile from '../../main/RemoteFile';

describe('GA4GHVariantJson', function() {
  var json;

  before(function(): any {
    return new RemoteFile('/test-data/variants.ga4gh.chr1.10000-11000.json').getAllString().then(data => {
      json = data;
    });
  });

  it('should filter variants from json', function(done) {
    
    var source = GA4GHVariantJson.create(json);

    var requestInterval = new ContigInterval('1', 10000, 10500);

    var variants = source.getVariantsInRange(requestInterval);
    expect(variants).to.have.length(3);
    done();

  });

  it('should not fail on empty json string', function(done) {

    var source = GA4GHVariantJson.create("{}");

    var requestInterval = new ContigInterval('1', 10, 20);

    var variants = source.getVariantsInRange(requestInterval);
    expect(variants).to.have.length(0);
    done();

  });

});

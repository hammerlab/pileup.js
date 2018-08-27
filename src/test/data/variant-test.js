/* @flow */
'use strict';

import {expect} from 'chai';
import {Variant} from '../../main/data/variant';
import _ from 'underscore';
import RemoteFile from '../../main/RemoteFile';

describe('Variant', function() {
  var json;

  before(function(): any {
    return new RemoteFile('/test-data/variants.ga4gh.chr1.10000-11000.json').getAllString().then(data => {
      json = data;
    });
  });

  it('should parse variants from GA4GH', function(done) {
    // parse json
    var parsedJson = JSON.parse(json);
    var variants = _.values(parsedJson.variants).map(variant => Variant.fromGA4GH(variant));

    expect(variants).to.have.length(11);
    expect(variants[0].contig).to.equal("1");
    expect(variants[0].position).to.equal(10176);
    expect(variants[0].ref).to.equal("A");
    expect(variants[0].alt[0]).to.equal("AC");
    done();
  });
});

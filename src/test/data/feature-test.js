/* @flow */
'use strict';

import {expect} from 'chai';
import Feature from '../../main/data/feature';
import _ from 'underscore';
import RemoteFile from '../../main/RemoteFile';

describe('Feature', function() {
  var json;

  before(function(): any {
    return new RemoteFile('/test-data/features.ga4gh.chr1.120000-125000.json').getAllString().then(data => {
      json = data;
    });
  });

  it('should parse features from GA4GH', function(done) {
    // parse json
    var parsedJson = JSON.parse(json);
    var features = _.values(parsedJson.features).map(feature => Feature.fromGA4GH(feature));

    expect(features).to.have.length(9);
    expect(features[0].position.contig).to.equal("chr1");
    expect(features[0].position.start()).to.equal(89295);
    expect(features[0].position.stop()).to.equal(120932);
    expect(features[0].id).to.equal("WyIxa2dlbm9tZXMiLCJnZW5jb2RlX3YyNGxpZnQzNyIsIjE0MDUwOTE3MjM1NDE5MiJd");
    expect(features[0].score).to.equal(1000);
    done();
  });
});

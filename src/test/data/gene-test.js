/* @flow */
'use strict';

import {expect} from 'chai';
import Gene from '../../main/data/gene';
import _ from 'underscore';
import RemoteFile from '../../main/RemoteFile';

describe('Gene', function() {
  var json;

  before(function(): any {
    return new RemoteFile('/test-data/refSeqGenes.chr17.75000000-75100000.json').getAllString().then(data => {
      json = data;
    });
  });

  it('should parse genes from GA4GH', function(done) {
    // parse json
    var parsedJson = JSON.parse(json);
    var genes = _.values(parsedJson.features).map(gene => Gene.fromGA4GH(gene));

    expect(genes).to.have.length(3);
    expect(genes[0].position.contig).to.equal("chr17");
    expect(genes[0].position.start()).to.equal(75084724);
    expect(genes[0].position.stop()).to.equal(75091068);
    expect(genes[0].score).to.equal(1000);
    expect(genes[0].name).to.equal("SNHG20");
    expect(genes[0].strand).to.equal('.');
    // check exons
    expect(genes[0].exons).to.have.length(3);
    expect(genes[0].exons[0].start).to.equal(75084724); // start
      expect(genes[0].exons[0].stop).to.equal(75085031); // start + blockSize
    expect(genes[0].codingRegion.start).to.equal(75091068);
    expect(genes[0].codingRegion.stop).to.equal(75091068);
    expect(genes[0].id).to.equal("NR_027058");
    expect(genes[0].geneId).to.equal("NR_027058");

    done();
  });
});

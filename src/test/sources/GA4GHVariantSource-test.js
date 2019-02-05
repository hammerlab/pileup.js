/** @flow */
'use strict';

import {expect} from 'chai';

import sinon from 'sinon';

import ContigInterval from '../../main/ContigInterval';
import GA4GHVariantSource from '../../main/sources/GA4GHVariantSource';
import RemoteFile from '../../main/RemoteFile';

describe('GA4GHVariantSource', function() {
  var server: any = null, response, source;

  beforeEach(function(): any {
    source = GA4GHVariantSource.create({
      endpoint: '/v0.6.0',
      variantSetId: "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIl0",
      callSetIds: ["WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIiwiSEcwMDA5NiJd"]
    });

    return new RemoteFile('/test-data/variants.ga4gh.chr1.10000-11000.json').getAllString().then(data => {
      response = data;
      server = sinon.fakeServer.create();
    });

  });

  afterEach(function() {
    server.restore();
  });

  it('should fetch variants from a server', function(done) {
    server.respondWith('POST', '/v0.6.0/variants/search',
                       [200, { "Content-Type": "application/json" }, response]);

    var requestInterval = new ContigInterval('1', 10000, 10500);
    expect(source.getVariantsInRange(requestInterval))
        .to.deep.equal([]);

    var progress = [];
    source.on('networkprogress', e => { progress.push(e); });
    source.on('networkdone', e => { progress.push('done'); });
    source.on('newdata', () => {
      var variants = source.getVariantsInRange(requestInterval);
      expect(variants).to.have.length(3);
      done();
    });

    source.rangeChanged({contig: '1', start: 10000, stop: 10500});
    server.respond();
  });

  it('should return empty with no data', function(done) {
    server.respondWith('POST', '/v0.6.0/variants/search',
                       [200, { "Content-Type": "application/json" }, response]);

    var requestInterval = new ContigInterval('2', 10000, 20000);
    expect(source.getVariantsInRange(requestInterval))
        .to.deep.equal([]);

    var progress = [];
    source.on('networkprogress', e => { progress.push(e); });
    source.on('networkdone', e => { progress.push('done'); });
    source.on('newdata', () => {
      var variants = source.getVariantsInRange(requestInterval);
      expect(variants).to.have.length(0);
      done();
    });

    source.rangeChanged({contig: '2', start: 10000, stop: 20000});
    server.respond();
  });

  it('should return genotype information', function(done) {
    server.respondWith('POST', '/v0.6.0/variants/search',
                       [200, { "Content-Type": "application/json" }, response]);

    var requestInterval = new ContigInterval('1', 10000, 10500);
    expect(source.getGenotypesInRange(requestInterval))
        .to.deep.equal([]);

    var progress = [];
    source.on('networkprogress', e => { progress.push(e); });
    source.on('networkdone', e => { progress.push('done'); });
    source.on('newdata', () => {
      var variants = source.getGenotypesInRange(requestInterval);
      expect(variants[0].calls).to.have.length(1);
      var call = variants[0].calls[0];
      expect(call.genotype).to.have.length(2);
      expect(call.callSetName).to.equal("HG00096");
      expect(call.phaseset).to.equal("True");
      done();
    });

    source.rangeChanged({contig: '1', start: 10000, stop: 10500});
    server.respond();
  });

  it('should genotype IDs after data is loaded', function(done) {
    source.getCallNames().then(samples => {
        expect(samples).to.have.length(1);
        done();
      });
  });
});

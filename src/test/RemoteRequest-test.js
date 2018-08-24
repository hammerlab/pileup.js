/** @flow */
'use strict';

import {expect} from 'chai';

import sinon from 'sinon';

import {RemoteRequest} from '../main/RemoteRequest';
import RemoteFile from '../main/RemoteFile';

describe('RemoteRequest', function() {
  var server: any = null, response;
  var url = '/test';
  var contig = 'chr17';
  var start = 10;
  var stop = 20;

  before(function(): any {
    return new RemoteFile('/test-data/alignments.ga4gh.chr17.1-250.json').getAllString().then(data => {
      response = data;
      server = sinon.fakeServer.create();
    });
  });

  after(function() {
    server.restore();
  });

  it('should fetch json from a server', function(done) {
    var remoteRequest = new RemoteRequest(url);
    var endpoint = remoteRequest.getEndpointFromContig(contig, start, stop);
    server.respondWith('GET', endpoint,
                       [200, { "Content-Type": "application/json" }, response]);

    var promisedData = remoteRequest.get(contig, start, stop);
    promisedData.then(obj => {
      var ret = obj.alignments;
      expect(remoteRequest.numNetworkRequests).to.equal(1);
      expect(ret.length).to.equal(14);
      done();
    });

    server.respond();
  });

  it('should cache data after server response', function(done) {
    var remoteRequest = new RemoteRequest(url);
    // verify cache is cleared for testing
    remoteRequest.cache.clear();
    var endpoint = remoteRequest.getEndpointFromContig(contig, start, stop);
    server.respondWith('GET', endpoint,
                       [200, { "Content-Type": "application/json" }, response]);

    var promisedData = remoteRequest.get(contig, start, stop);
    promisedData.then(obj => {
      var promisedData2 = remoteRequest.get(contig, start, stop);
      promisedData2.then(obj2 => {
        var ret = obj2.alignments;
        expect(remoteRequest.numNetworkRequests).to.equal(1);
        expect(ret.length).to.equal(14);
        done();
      });
    });

    server.respond();
  });
});

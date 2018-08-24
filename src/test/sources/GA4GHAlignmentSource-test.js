/** @flow */
'use strict';

import {expect} from 'chai';

import sinon from 'sinon';

import ContigInterval from '../../main/ContigInterval';
import GA4GHAlignmentSource from '../../main/sources/GA4GHAlignmentSource';
import RemoteFile from '../../main/RemoteFile';

describe('GA4GHAlignmentSource', function() {
  var server: any = null;
  var response: any = null;

  before(function(): any {
    return new RemoteFile('/test-data/alignments.ga4gh.1.10000-11000.json').getAllString().then(data => {
      response = data;
      server = sinon.fakeServer.create();  // _after_ we do a real XHR!
    });
  });

  after(function() {
    server.restore();
  });

  it('should fetch alignments from a server', function(done) {
    server.respondWith('POST', '/v0.6.0a10/reads/search',
                       [200, { "Content-Type": "application/json" }, response]);

    var source = GA4GHAlignmentSource.create({
      endpoint: '/v0.6.0a10',
      readGroupId: 'some-group-set:some-read-group',
      forcedReferenceId: null
    });

    var requestInterval = new ContigInterval('1', 10000, 10007);
    expect(source.getAlignmentsInRange(requestInterval))
        .to.deep.equal([]);

    var progress = [];
    source.on('networkprogress', e => { progress.push(e); });
    source.on('networkdone', e => { progress.push('done'); });
    source.on('newdata', () => {
      var reads = source.getAlignmentsInRange(requestInterval);
      expect(reads).to.have.length(16);
      done();
    });

    source.rangeChanged({contig: '1', start: 10000, stop: 10007});
    server.respond();
  });

});

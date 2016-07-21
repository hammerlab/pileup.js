/** @flow */
'use strict';

import {expect} from 'chai';

import sinon from 'sinon';

import ContigInterval from '../../main/ContigInterval';
import CoverageDataSource from '../../main/sources/CoverageDataSource';
import RemoteFile from '../../main/RemoteFile';

describe('CoverageDataSource', function() {
  var server: any = null, response;

  before(function () {
    return new RemoteFile('/test-data/chrM-coverage.json').getAllString().then(data => {
      response = data;
      server = sinon.fakeServer.create();
      server.respondWith('GET', '/coverage/chrM?start=1&end=1000&binning=1',[200, { "Content-Type": "application/json" }, response]);
    });
  });

  after(function () {
    server.restore();
  });

  it('should fetch coverage points from a server', function(done) {

    var source = CoverageDataSource.create({
      url: '/coverage'
    });

    var requestInterval = new ContigInterval('chrM', 10, 30);
    expect(source.getCoverageInRange(requestInterval))
        .to.deep.equal([]);

    source.on('newdata', () => {
      var coverage = source.getCoverageInRange(requestInterval);
      expect(coverage).to.have.length(12);
      done();
    });

    source.rangeChanged({contig: 'chrM', start: 10, stop: 30});
    server.respond();
  });

  it('should cache coverage after first call', function(done) {

    var source = CoverageDataSource.create({
      url: '/coverage'
    });
    var requestCount = 0;
    var requestInterval = new ContigInterval('chrM', 10, 20);
    expect(source.getCoverageInRange(requestInterval))
        .to.deep.equal([]);

    var progress = [];
    source.on('networkprogress', e => { progress.push(e); });
    source.on('networkdone', e => { progress.push('done'); });
    source.on('newdata', () => {
      requestCount += 1;
      expect(requestCount == 1);
      done();
    });

    source.rangeChanged({contig: 'chrM', start: 1, stop: 30});
    source.rangeChanged({contig: 'chrM', start: 2, stop: 8});

    server.respond();

  });

  it('should bin coverage over large regions', function(done) {

    var source = CoverageDataSource.create({
      url: '/coverage'
    });
    var requestCount = 0;
    var requestInterval = new ContigInterval('chrM', 10, 20);
    expect(source.getCoverageInRange(requestInterval))
        .to.deep.equal([]);

    var progress = [];
    source.on('networkprogress', e => { progress.push(e); });
    source.on('networkdone', e => { progress.push('done'); });
    source.on('newdata', () => {
      requestCount += 1;
      expect(requestCount == 1);
      done();
    });

    source.rangeChanged({contig: 'chrM', start: 1, stop: 30});
    source.rangeChanged({contig: 'chrM', start: 2, stop: 8});

    server.respond();

  });

});

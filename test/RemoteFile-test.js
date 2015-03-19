/* @flow */
'use strict';

var chai = require('chai'),
    expect = chai.expect,
    jBinary = require('jbinary');

var RemoteFile = require('../src/RemoteFile');

describe('RemoteFile', () => {
  function bufferToText(buf) {
    return new jBinary(buf).read('string');
  }

  it('should fetch a subset of a file', done => {
    var f = new RemoteFile('/test/data/0to9.txt');
    var promisedData = f.getBytes(4, 5);

    expect(f.numNetworkRequests).to.equal(1);
    promisedData.then(buf => {
      expect(buf.byteLength).to.equal(5);
      expect(bufferToText(buf)).to.equal('45678');
      done();
    }).done();
  });

  it('should fetch subsets from cache', done => {
    var f = new RemoteFile('/test/data/0to9.txt');
    f.getBytes(0, 10).then(buf => {
      expect(buf.byteLength).to.equal(10);
      expect(bufferToText(buf)).to.equal('0123456789');
      expect(f.numNetworkRequests).to.equal(1);
      f.getBytes(4, 5).then(buf => {
        expect(buf.byteLength).to.equal(5);
        expect(bufferToText(buf)).to.equal('45678');
        expect(f.numNetworkRequests).to.equal(1);  // it was cached
        done();
      }).done();
    }).done();
  });
});

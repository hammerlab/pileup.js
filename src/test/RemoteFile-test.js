/* @flow */
'use strict';

var expect = require('chai').expect;

var jBinary = require('jbinary');

var RemoteFile = require('../src/RemoteFile');

describe('RemoteFile', () => {
  function bufferToText(buf) {
    return new jBinary(buf).read('string');
  }

  it('should fetch a subset of a file', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    var promisedData = f.getBytes(4, 5);

    expect(f.numNetworkRequests).to.equal(1);
    return promisedData.then(buf => {
      expect(buf.byteLength).to.equal(5);
      expect(bufferToText(buf)).to.equal('45678');
    });
  });

  it('should fetch subsets from cache', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    return f.getBytes(0, 10).then(buf => {
      expect(buf.byteLength).to.equal(10);
      expect(bufferToText(buf)).to.equal('0123456789');
      expect(f.numNetworkRequests).to.equal(1);
      return f.getBytes(4, 5).then(buf => {
        expect(buf.byteLength).to.equal(5);
        expect(bufferToText(buf)).to.equal('45678');
        expect(f.numNetworkRequests).to.equal(1);  // it was cached
      });
    });
  });

  it('should fetch entire files', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    return f.getAll().then(buf => {
      expect(buf.byteLength).to.equal(11);
      expect(bufferToText(buf)).to.equal('0123456789\n');
      expect(f.numNetworkRequests).to.equal(1);
    });
  });

  it('should determine file lengths', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    return f.getSize().then(size => {
      expect(size).to.equal(11);
      // TODO: make sure this was a HEAD request
      expect(f.numNetworkRequests).to.equal(1);
    });
  });

  it('should get file lengths from full requests', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    return f.getAll().then(buf => {
      expect(f.numNetworkRequests).to.equal(1);
      return f.getSize().then(size => {
        expect(size).to.equal(11);
        expect(f.numNetworkRequests).to.equal(1);  // no additional requests
      });
    });
  });

  it('should get file lengths from range requests', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    return f.getBytes(4, 5).then(buf => {
      expect(f.numNetworkRequests).to.equal(1);
      return f.getSize().then(size => {
        expect(size).to.equal(11);
        expect(f.numNetworkRequests).to.equal(1);  // no additional requests
      });
    });
  });

  it('should cache requests for full files', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    f.getAll().then(buf => {
      expect(buf.byteLength).to.equal(11);
      expect(bufferToText(buf)).to.equal('0123456789\n');
      expect(f.numNetworkRequests).to.equal(1);
      return f.getAll().then(buf => {
        expect(buf.byteLength).to.equal(11);
        expect(bufferToText(buf)).to.equal('0123456789\n');
        expect(f.numNetworkRequests).to.equal(1);  // still 1
      });
    });
  });

  it('should serve range requests from cache after getAll', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    return f.getAll().then(buf => {
      expect(buf.byteLength).to.equal(11);
      expect(bufferToText(buf)).to.equal('0123456789\n');
      expect(f.numNetworkRequests).to.equal(1);
      return f.getBytes(4, 5).then(buf => {
        expect(buf.byteLength).to.equal(5);
        expect(bufferToText(buf)).to.equal('45678');
        expect(f.numNetworkRequests).to.equal(1);  // still 1
      });
    });
  });

  it('should reject requests to a non-existent file', function() {
    var f = new RemoteFile('/test/data/nonexistent-file.txt');
    return f.getAll().then(buf => {
      throw 'Requests for non-existent files should not succeed';
    }, err => {
      expect(err).to.match(/404/);
    });
  });

  it('should truncate requests past EOF', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    var promisedData = f.getBytes(4, 100);

    return promisedData.then(buf => {
      expect(buf.byteLength).to.equal(7);
      expect(bufferToText(buf)).to.equal('456789\n');
      expect(f.numNetworkRequests).to.equal(1);
      return f.getBytes(6, 90).then(buf => {
        expect(buf.byteLength).to.equal(5);
        expect(bufferToText(buf)).to.equal('6789\n');
        expect(f.numNetworkRequests).to.equal(1);
      });
    });
  });

  it('should fetch entire files as strings', function() {
    var f = new RemoteFile('/test/data/0to9.txt');
    return f.getAllString().then(txt => {
      expect(txt).to.equal('0123456789\n');
    });
  });
});

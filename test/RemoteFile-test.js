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

  it('should fetch entire files', done => {
    var f = new RemoteFile('/test/data/0to9.txt');
    f.getAll().then(buf => {
      expect(buf.byteLength).to.equal(11);
      expect(bufferToText(buf)).to.equal('0123456789\n');
      expect(f.numNetworkRequests).to.equal(1);
      done();
    }).done();
  });

  it('should determine file lengths', done => {
    var f = new RemoteFile('/test/data/0to9.txt');
    f.getSize().then(size => {
      expect(size).to.equal(11);
      // TODO: make sure this was a HEAD request
      expect(f.numNetworkRequests).to.equal(1);
      done();
    }).done();
  });

  it('should get file lengths from full requests', done => {
    var f = new RemoteFile('/test/data/0to9.txt');
    f.getAll().then(buf => {
      expect(f.numNetworkRequests).to.equal(1);
      return f.getSize().then(size => {
        expect(size).to.equal(11);
        expect(f.numNetworkRequests).to.equal(1);  // no additional requests
        done();
      });
    }).done();
  });

  it('should get file lengths from range requests', done => {
    var f = new RemoteFile('/test/data/0to9.txt');
    f.getBytes(4, 5).then(buf => {
      expect(f.numNetworkRequests).to.equal(1);
      return f.getSize().then(size => {
        expect(size).to.equal(11);
        expect(f.numNetworkRequests).to.equal(1);  // no additional requests
        done();
      });
    }).done();
  });

  it('should cache requests for full files', done => {
    var f = new RemoteFile('/test/data/0to9.txt');
    f.getAll().then(buf => {
      expect(buf.byteLength).to.equal(11);
      expect(bufferToText(buf)).to.equal('0123456789\n');
      expect(f.numNetworkRequests).to.equal(1);
      return f.getAll().then(buf => {
        expect(buf.byteLength).to.equal(11);
        expect(bufferToText(buf)).to.equal('0123456789\n');
        expect(f.numNetworkRequests).to.equal(1);  // still 1
        done();
      });
    }).done();
  });

  it('should serve range requests from cache after getAll', done => {
    var f = new RemoteFile('/test/data/0to9.txt');
    f.getAll().then(buf => {
      expect(buf.byteLength).to.equal(11);
      expect(bufferToText(buf)).to.equal('0123456789\n');
      expect(f.numNetworkRequests).to.equal(1);
      return f.getBytes(4, 5).then(buf => {
        expect(buf.byteLength).to.equal(5);
        expect(bufferToText(buf)).to.equal('45678');
        expect(f.numNetworkRequests).to.equal(1);  // still 1
        done();
      });
    }).done();
  });

  it('should reject requests to a non-existent file', done => {
    var f = new RemoteFile('/test/data/nonexistent-file.txt');
    f.getAll().then(buf => {
      throw 'Requests for non-existent files should not succeed';
    }, err => {
      expect(err).to.match(/404/);
      done();
    }).done();
  });

  it('should truncate requests past EOF', done => {
    var f = new RemoteFile('/test/data/0to9.txt');
    var promisedData = f.getBytes(4, 100);

    promisedData.then(buf => {
      expect(buf.byteLength).to.equal(7);
      expect(bufferToText(buf)).to.equal('456789\n');
      expect(f.numNetworkRequests).to.equal(1);
      return f.getBytes(6, 90).then(buf => {
        expect(buf.byteLength).to.equal(5);
        expect(bufferToText(buf)).to.equal('6789\n');
        expect(f.numNetworkRequests).to.equal(1);
        done();
      });
    }).done();
  });
});

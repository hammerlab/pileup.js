/* @flow */
'use strict';

import {expect, fail} from 'chai';

import LocalStringFile from '../main/LocalStringFile';
import jBinary from 'jbinary';

describe('LocalStringFile', () => {
  function bufferToText(buf) {
    return new jBinary(buf).read('string');
  }

  it('should fetch a subset of a file', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    var promisedData = f.getBytes(4, 5);

    return promisedData.then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(5);
        expect(bufferToText(buf)).to.equal('45678');
      }
      done();
    });
  });

  it('should fetch subsets from cache', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    return f.getBytes(0, 10).then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(10);
        expect(bufferToText(buf)).to.equal('0123456789');
      } 
      return f.getBytes(4, 5).then(buf => {
        expect(buf).to.not.be.null;
        if (buf != null) {
          expect(buf.byteLength).to.equal(5);
          expect(bufferToText(buf)).to.equal('45678');
        } 
        done();
      });
    });
  });

  it('should fetch entire files', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    return f.getAll().then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(11);
        expect(bufferToText(buf)).to.equal('0123456789\n');
      } 
      done();
    });
  });

  it('should determine file lengths', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    return f.getSize().then(size => {
      expect(size).to.equal(11);
      done();
    });
  });

  it('should get file lengths from full requests', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    return f.getAll().then(buf => {
      return f.getSize().then(size => {
        expect(size).to.equal(11);
        done();
      });
    });
  });

  it('should get file lengths from range requests', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    return f.getBytes(4, 5).then(buf => {
      return f.getSize().then(size => {
        expect(size).to.equal(11);
        done();
      });
    });
  });

  it('should cache requests for full files', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    return f.getAll().then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(11);
        expect(bufferToText(buf)).to.equal('0123456789\n');
      }
      return f.getAll().then(buf => {
        expect(buf).to.not.be.null;
        if (buf != null) {
          expect(buf.byteLength).to.equal(11);
          expect(bufferToText(buf)).to.equal('0123456789\n');
        }
        done();
      });
    });
  });

  it('should serve range requests from cache after getAll', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    return f.getAll().then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(11);
        expect(bufferToText(buf)).to.equal('0123456789\n');
      }
      return f.getBytes(4, 5).then(buf => {
        expect(buf).to.not.be.null;
        if (buf != null) {
          expect(buf.byteLength).to.equal(5);
          expect(bufferToText(buf)).to.equal('45678');
        }
        done();
      });
    });
  });

  it('should truncate requests past EOF', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    var promisedData = f.getBytes(4, 100);

    return promisedData.then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(7);
        expect(bufferToText(buf)).to.equal('456789\n');
      }
      return f.getBytes(6, 90).then(buf => {
        expect(buf).to.not.be.null;
        if (buf != null) {
          expect(buf.byteLength).to.equal(5);
          expect(bufferToText(buf)).to.equal('6789\n');
        }
        done();
      });
    });
  });

  it('should fetch entire files as strings', function(done): any {
    var f = new LocalStringFile('0123456789\n');
    return f.getAllString().then(txt => {
      expect(txt).to.equal('0123456789\n');
      done();
    });
  });
});

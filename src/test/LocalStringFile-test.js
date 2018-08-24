/* @flow */
'use strict';

import {expect, fail} from 'chai';

import LocalStringFile from '../main/LocalStringFile';
import jBinary from 'jbinary';

describe('LocalStringFile', () => {
  function bufferToText(buf) {
    return new jBinary(buf).read('string');
  }

  it('should fetch a subset of a file', function() {
    var f = new LocalStringFile('0123456789\n');
    var promisedData = f.getBytes(4, 5);

    promisedData.then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(5);
        expect(bufferToText(buf)).to.equal('45678');
      }
    });
  });

  it('should fetch subsets from cache', function() {
    var f = new LocalStringFile('0123456789\n');
    f.getBytes(0, 10).then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(10);
        expect(bufferToText(buf)).to.equal('0123456789');
      } 
      f.getBytes(4, 5).then(buf => {
        expect(buf).to.not.be.null;
        if (buf != null) {
          expect(buf.byteLength).to.equal(5);
          expect(bufferToText(buf)).to.equal('45678');
        } 
      });
    });
  });

  it('should fetch entire files', function() {
    var f = new LocalStringFile('0123456789\n');
    f.getAll().then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(11);
        expect(bufferToText(buf)).to.equal('0123456789\n');
      } 
    });
  });

  it('should determine file lengths', function() {
    var f = new LocalStringFile('0123456789\n');
    f.getSize().then(size => {
      expect(size).to.equal(11);
    });
  });

  it('should get file lengths from full requests', function() {
    var f = new LocalStringFile('0123456789\n');
    f.getAll().then(buf => {
      f.getSize().then(size => {
        expect(size).to.equal(11);
      });
    });
  });

  it('should get file lengths from range requests', function() {
    var f = new LocalStringFile('0123456789\n');
    f.getBytes(4, 5).then(buf => {
      f.getSize().then(size => {
        expect(size).to.equal(11);
      });
    });
  });

  it('should cache requests for full files', function() {
    var f = new LocalStringFile('0123456789\n');
    f.getAll().then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(11);
        expect(bufferToText(buf)).to.equal('0123456789\n');
      }
      f.getAll().then(buf => {
        expect(buf).to.not.be.null;
        if (buf != null) {
          expect(buf.byteLength).to.equal(11);
          expect(bufferToText(buf)).to.equal('0123456789\n');
        }
      });
    });
  });

  it('should serve range requests from cache after getAll', function() {
    var f = new LocalStringFile('0123456789\n');
    f.getAll().then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(11);
        expect(bufferToText(buf)).to.equal('0123456789\n');
      }
      f.getBytes(4, 5).then(buf => {
        expect(buf).to.not.be.null;
        if (buf != null) {
          expect(buf.byteLength).to.equal(5);
          expect(bufferToText(buf)).to.equal('45678');
        }
      });
    });
  });

  it('should truncate requests past EOF', function() {
    var f = new LocalStringFile('0123456789\n');
    var promisedData = f.getBytes(4, 100);

    promisedData.then(buf => {
      expect(buf).to.not.be.null;
      if (buf != null) {
        expect(buf.byteLength).to.equal(7);
        expect(bufferToText(buf)).to.equal('456789\n');
      }
      f.getBytes(6, 90).then(buf => {
        expect(buf).to.not.be.null;
        if (buf != null) {
          expect(buf.byteLength).to.equal(5);
          expect(bufferToText(buf)).to.equal('6789\n');
        }
      });
    });
  });

  it('should fetch entire files as strings', function() {
    var f = new LocalStringFile('0123456789\n');
    f.getAllString().then(txt => {
      expect(txt).to.equal('0123456789\n');
    });
  });
});

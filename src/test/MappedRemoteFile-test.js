/* @flow */
'use strict';

var expect = require('chai').expect;

var jBinary = require('jbinary'),
    Q = require('q');

var MappedRemoteFile = require('./MappedRemoteFile');

describe('MappedRemoteFile', function() {
  function bufferToText(buf) {
    return new jBinary(buf).read('string');
  }

  it('should serve requests through the map', function() {
    var remoteFile = new MappedRemoteFile('/test-data/0to9.txt', [
      [0, 2],  // 0,1,2
      [12345678, 12345680],  // 3,4,5
      [9876543210, 9876543214]  // 6,7,8,9,\n
    ]);

    var promises = [
      remoteFile.getBytes(0, 3).then(buf => {
        expect(bufferToText(buf)).to.equal('012');
      }),

      remoteFile.getBytes(12345678, 2).then(buf => {
        expect(bufferToText(buf)).to.equal('34');
      }),

      remoteFile.getBytes(9876543211, 3).then(buf => {
        expect(bufferToText(buf)).to.equal('789');
      }),

      remoteFile.getBytes(9876543211, 10).then(buf => {
        throw 'Requests for unmapped ranges should fail';
      }, err => {
        expect(err).to.match(/is not mapped/);
      }),

      remoteFile.getBytes(23456789, 1).then(buf => {
        throw 'Requests for unmapped ranges should fail';
      }, err => {
        expect(err).to.match(/is not mapped/);
      }),
    ];

    return Q.all(promises);
  });

  it('should forget file length', function() {
    var remoteFile = new MappedRemoteFile('/test-data/0to9.txt', [
      [0, 2],  // 0,1,2
      [12345673, 12345690]  // 3456789\n
    ]);

    return remoteFile.getBytes(0, 3).then(buf => {
      expect(bufferToText(buf)).to.equal('012');
      // This second read would fail if the file remembered its length.
      return remoteFile.getBytes(12345673, 8).then(buf => {
        expect(bufferToText(buf)).to.equal('3456789\n');
      });
    });
  });
});

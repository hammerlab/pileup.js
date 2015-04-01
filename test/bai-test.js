/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;

var BaiFile = require('../src/bai'),
    RemoteFile = require('../src/RemoteFile');

describe('BAI', function() {
  it('should parse BAI files', function(done) {
    var bai = new BaiFile(new RemoteFile('/test/data/test_input_1_a.bam.bai'));
    bai.index.then(index => {
      console.log(index);
      done();
    });
  });
});

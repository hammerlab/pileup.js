/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;

var BaiFile = require('../src/bai'),
    Bam = require('../src/bam'),
    ContigInterval = require('../src/ContigInterval'),
    RemoteFile = require('../src/RemoteFile');

describe('BAI', function() {
  it('should parse BAI files', function(done) {
    var bai = new BaiFile(new RemoteFile('/test/data/test_input_1_a.bam.bai'));
    var bam = new Bam(new RemoteFile('/test/data/test_input_1_a.bam'));
    bam.readAll().done();

    bai.getChunksForInterval(new ContigInterval(0, 10, 20)).then(chunks => {
      console.log(chunks);
      done();
    }).done();
  });

  it('should parse large BAI files', function(done) {
    var bai = new BaiFile(new RemoteFile('/test/data/large.bam.bai'));
    bai.getChunksForInterval(new ContigInterval(0, 10, 20)).then(chunks => {
      done();
    }).done();
  });
});

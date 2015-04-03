/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;
var jBinary = require('jbinary');

var BaiFile = require('../src/bai'),
    Bam = require('../src/bam'),
    bamTypes = require('../src/formats/bamTypes'),
    ContigInterval = require('../src/ContigInterval'),
    RemoteFile = require('../src/RemoteFile');

function chunkToString(chunk) {
  return `${chunk.chunk_beg}-${chunk.chunk_end}`;
}

describe('BAI', function() {
  it('should parse virtual offsets', function() {
    var u8 = new Uint8Array([201, 121, 79, 100, 96, 92, 1, 0]);
    var vo = new jBinary(u8, bamTypes.TYPE_SET).read('VirtualOffset');
    // (expected values from dalliance)
    expect(vo.uoffset).to.equal(31177);
    expect(vo.coffset).to.equal(5844788303);
  });

  // This matches htsjdk's BamFileIndexTest.testSpecificQueries
  it('should parse large BAI files', function(done) {
    var bai = new BaiFile(new RemoteFile('/test/data/index_test.bam.bai'));
    // index 0 = chrM

    bai.getChunksForInterval(new ContigInterval(0, 10400, 10600)).then(chunks => {
      expect(chunks).to.have.length(1);
      expect(chunkToString(chunks[0])).to.equal('0:8384-0:11328');
      done();
    }).done();
  });
});

/* @flow */
'use strict';

import type * as Q from 'q';

var chai = require('chai');
var expect = chai.expect;

var jBinary = require('jbinary');

var RemoteFile = require('../src/RemoteFile'),
    utils = require('../src/utils'),
    Bam = require('../src/bam'),
    bamTypes = require('../src/formats/bamTypes'),
    SamRead = require('../src/SamRead');

describe('SamRead', function() {

  function getSamArray(url): Q.Promise<SamRead[]> {
    var file = new RemoteFile(url);
    return file.getAll().then(gzipBuffer => {
      var buf = utils.inflateGzip(gzipBuffer);
      var jb = new jBinary(buf, bamTypes.TYPE_SET);
      jb.read('BamHeader');  // skip past the header to get to alignments.
      return jb.read(['array', {
        block_size: 'int32',
        contents: ['blob', 'block_size']
      }]).map(block => new SamRead(block.contents));
    });
  }

  var testReads = getSamArray('/test/data/test_input_1_a.bam');

  // This is more of a test for the test than for SamRead.
  it('should pull records from a BAM file', function(done) {
    testReads.then(reads => {
      expect(reads).to.have.length(15);
      done();
    }).done();
  });

  it('should parse BAM records', function(done) {
    testReads.then(reads => {
      // The first record in test_input_1_a.sam is:
      // r000 99 insert 50 30 10M = 80 30 ATTTAGCTAC AAAAAAAAAA RG:Z:cow PG:Z:bull
      var read = reads[0];
      expect(read.getName()).to.equal('r000');
      // expect(read.FLAG).to.equal(99);
      expect(read.refID).to.equal(0);
      expect(read.pos).to.equal(49);  // 0-based
      expect(read.l_seq).to.equal(10);
      // expect(refs[r000.refID].name).to.equal('insert');

      done();
    }).done();
  });

  it('should read thick records', function(done) {
    testReads.then(reads => {
      // This mirrors the "BAM > should parse BAM files" test.
      var r000 = reads[0].getFull();
      expect(r000.read_name).to.equal('r000');
      expect(r000.FLAG).to.equal(99);
      expect(r000.refID).to.equal(0);
      // .. POS
      expect(r000.MAPQ).to.equal(30);
      expect(Bam.makeCigarString(r000.cigar)).to.equal('10M');
      // next ref
      // next pos
      expect(r000.tlen).to.equal(30);
      expect(r000.seq).to.equal('ATTTAGCTAC');
      expect(Bam.makeAsciiPhred(r000.qual)).to.equal('AAAAAAAAAA');

      var aux = r000.auxiliary;
      expect(aux).to.have.length(2);
      expect(aux[0]).to.contain({tag: 'RG', value: 'cow'});
      expect(aux[1]).to.contain({tag: 'PG', value: 'bull'});
      done();
    }).done();
  });
});

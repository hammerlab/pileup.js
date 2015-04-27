/* @flow */
'use strict';

import type * as Q from 'q';

var expect = require('chai').expect;

var jBinary = require('jbinary');

var RemoteFile = require('../src/RemoteFile'),
    utils = require('../src/utils'),
    bamTypes = require('../src/formats/bamTypes'),
    SamRead = require('../src/SamRead'),
    VirtualOffset = require('../src/VirtualOffset'),
    ContigInterval = require('../src/ContigInterval');

describe('SamRead', function() {

  function getSamArray(url): Q.Promise<SamRead[]> {
    var zero = new VirtualOffset(0, 0);
    var file = new RemoteFile(url);
    return file.getAll().then(gzipBuffer => {
      var buf = utils.inflateGzip(gzipBuffer);
      var jb = new jBinary(buf, bamTypes.TYPE_SET);
      jb.read('BamHeader');  // skip past the header to get to alignments.
      return jb.read(['array', {
        block_size: 'int32',
        contents: ['blob', 'block_size']
      }]).map(block => new SamRead(block.contents, zero, 'ref'));
    });
  }

  var testReads = getSamArray('/test/data/test_input_1_a.bam');

  // This is more of a test for the test than for SamRead.
  it('should pull records from a BAM file', function() {
    return testReads.then(reads => {
      expect(reads).to.have.length(15);
    });
  });

  it('should parse BAM records', function() {
    return testReads.then(reads => {
      // The first record in test_input_1_a.sam is:
      // r000 99 insert 50 30 10M = 80 30 ATTTAGCTAC AAAAAAAAAA RG:Z:cow PG:Z:bull
      var read = reads[0];
      expect(read.getName()).to.equal('r000');
      expect(read.refID).to.equal(0);
      expect(read.ref).to.equal('ref');
      expect(read.pos).to.equal(49);  // 0-based
      expect(read.l_seq).to.equal(10);
      expect(read.toString()).to.equal('ref:50-59');
      expect(read.getCigarOps()).to.deep.equal([{op: 'M', length: 10}]);

      // This one has a more interesting Cigar string
      expect(reads[3].getCigarOps()).to.deep.equal([
        {op: 'S', length: 1},
        {op: 'I', length: 2},
        {op: 'M', length: 6},
        {op: 'P', length: 1},
        {op: 'I', length: 1},
        {op: 'P', length: 1},
        {op: 'I', length: 1},
        {op: 'M', length: 4},
        {op: 'I', length: 2}
      ]);
    });
  });

  it('should read thick records', function() {
    return testReads.then(reads => {
      // This mirrors the "BAM > should parse BAM files" test.
      var r000 = reads[0].getFull();
      expect(r000.read_name).to.equal('r000');
      expect(r000.FLAG).to.equal(99);
      expect(r000.refID).to.equal(0);
      // .. POS
      expect(r000.MAPQ).to.equal(30);
      expect(reads[0].getCigarString()).to.equal('10M');
      // next ref
      // next pos
      expect(r000.tlen).to.equal(30);
      expect(r000.seq).to.equal('ATTTAGCTAC');
      expect(reads[0].getSequence()).to.equal('ATTTAGCTAC');
      expect(reads[0].getQualPhred()).to.equal('AAAAAAAAAA');

      var aux = r000.auxiliary;
      expect(aux).to.have.length(2);
      expect(aux[0]).to.contain({tag: 'RG', value: 'cow'});
      expect(aux[1]).to.contain({tag: 'PG', value: 'bull'});
    });
  });

  it('should find record intersections', function() {
    return testReads.then(reads => {
      var read = reads[0];
      // toString() produces a 1-based result, but ContigInterval is 0-based.
      expect(read.toString()).to.equal('ref:50-59');
      expect(read.intersects(new ContigInterval('ref', 40, 49))).to.be.true;
      expect(read.intersects(new ContigInterval('ref', 40, 48))).to.be.false;
      expect(read.intersects(new ContigInterval('0', 40, 55))).to.be.false;
      expect(read.intersects(new ContigInterval('ref', 58, 60))).to.be.true;
      expect(read.intersects(new ContigInterval('ref', 59, 60))).to.be.false;
    });
  });
});

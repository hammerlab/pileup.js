/* @flow */
'use strict';

import type * as Q from 'q';
import type * as SamRead from '../main/SamRead';

var expect = require('chai').expect;

var RemoteFile = require('../main/RemoteFile'),
    Bam = require('../main/bam'),
    ContigInterval = require('../main/ContigInterval');

describe('SamRead', function() {

  function getSamArray(url): Q.Promise<SamRead[]> {
    return new Bam(new RemoteFile(url)).readAll().then(d => d.alignments);
  }

  var testReads = getSamArray('/test-data/test_input_1_a.bam');

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
      expect(read.name).to.equal('r000');
      expect(read.refID).to.equal(0);
      expect(read.ref).to.equal('insert');
      expect(read.pos).to.equal(49);  // 0-based
      expect(read.l_seq).to.equal(10);
      expect(read.toString()).to.equal('insert:50-59');
      expect(read.cigarOps).to.deep.equal([{op: 'M', length: 10}]);
      expect(read.getStrand()).to.equal('+');

      expect(read.getMateProperties()).to.deep.equal({
        ref: 'insert',  // same as read.ref
        pos: 79,
        strand: '-'
      });

      // This one has a more interesting Cigar string
      expect(reads[3].cigarOps).to.deep.equal([
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
      expect(reads[0].ref).to.equal('insert');
      // .. POS
      expect(r000.MAPQ).to.equal(30);
      expect(reads[0].getCigarString()).to.equal('10M');
      expect(r000.next_pos).to.equal(79);
      expect(r000.next_refID).to.equal(0);

      expect(r000.tlen).to.equal(30);
      expect(r000.seq).to.equal('ATTTAGCTAC');
      expect(reads[0].getSequence()).to.equal('ATTTAGCTAC');
      expect(reads[0].getQualPhred()).to.equal('AAAAAAAAAA');

      var aux = r000.auxiliary;
      expect(aux).to.have.length(2);
      expect(aux[0]).to.contain({tag: 'RG', value: 'cow'});
      expect(aux[1]).to.contain({tag: 'PG', value: 'bull'});

      expect(reads).to.have.length(15);
      expect(reads[14].refID).to.equal(-1);  // unmapped read
      expect(reads[14].ref).to.equal('');
    });
  });

  it('should find record intersections', function() {
    return testReads.then(reads => {
      var read = reads[0];
      // toString() produces a 1-based result, but ContigInterval is 0-based.
      expect(read.toString()).to.equal('insert:50-59');
      expect(read.intersects(new ContigInterval('insert', 40, 49))).to.be.true;
      expect(read.intersects(new ContigInterval('insert', 40, 48))).to.be.false;
      expect(read.intersects(new ContigInterval('0', 40, 55))).to.be.false;
      expect(read.intersects(new ContigInterval('insert', 58, 60))).to.be.true;
      expect(read.intersects(new ContigInterval('insert', 59, 60))).to.be.false;
    });
  });
});

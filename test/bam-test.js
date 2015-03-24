/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;

var Bam = require('../src/bam'),
    RemoteFile = require('../src/RemoteFile');

describe('BAM', function() {
  it('should parse BAM files', function(done) {
    var bamFile = new Bam(new RemoteFile('/test/data/test_input_1_a.bam'));
    bamFile.readAll().then(bamData => {
      var refs = bamData.header.references;
      expect(refs).to.have.length(4);
      expect(refs[0]).to.contain({l_ref: 599, name: 'insert'});
      expect(refs[3]).to.contain({l_ref: 4, name: 'ref3'});

      // TODO: test bamData.header.text

      var aligns = bamData.alignments;
      expect(aligns).to.have.length(15);

      // The first record in test_input_1_a.sam is:
      // r000 99 insert 50 30 10M = 80 30 ATTTAGCTAC AAAAAAAAAA RG:Z:cow PG:Z:bull
      var r000 = aligns[0];
      expect(r000.read_name).to.equal('r000');
      expect(r000.FLAG).to.equal(99);
      expect(refs[r000.refID].name).to.equal('insert');
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
      expect(aux[0]).to.contain({tag: 'RG', value:'cow'});
      expect(aux[1]).to.contain({tag: 'PG', value:'bull'});


      // TODO: tests for a few more records, particularly:
      // - one with 'B'-format auxiliary data
      // - one with a more interesting Phred string
      // - one with a more interesting Cigar string
      done();
    }).done();
  });
});

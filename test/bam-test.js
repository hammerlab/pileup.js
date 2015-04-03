/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;

var Bam = require('../src/bam'),
    ContigInterval = require('../src/ContigInterval'),
    RemoteFile = require('../src/RemoteFile'),
    VirtualOffset = require('../src/VirtualOffset');

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
      expect(aux[0]).to.contain({tag: 'RG', value: 'cow'});
      expect(aux[1]).to.contain({tag: 'PG', value: 'bull'});


      // This one has more interesting auxiliary data:
      // XX:B:S,12561,2,20,112
      aux = aligns[2].auxiliary;
      expect(aux).to.have.length(4);
      expect(aux[0]).to.contain({tag: 'XX'});
      expect(aux[0].value.values).to.deep.equal([12561, 2, 20, 112]);
      expect(aux[1]).to.contain({tag: 'YY', value: 100});
      expect(aux[2]).to.contain({tag: 'RG', value: 'fish'});
      expect(aux[3]).to.contain({tag: 'PG', value: 'colt'});

      // This one has a more interesting Cigar string
      expect(Bam.makeCigarString(aligns[3].cigar)).to.equal('1S2I6M1P1I1P1I4M2I');

      // - one with a more interesting Phred string
      done();
    }).done();
  });
  
  // it('should find sequences using an index', function(done) {
  //   var bam = new Bam(new RemoteFile('/test/data/index_test.bam'),
  //                     new RemoteFile('/test/data/index_test.bam.bai'));

  //   // TODO: run these in parallel
  //   var range = new ContigInterval('chrM', 10400, 10600);
  //   bam.getAlignmentsInRange(range, true).then(chunks => {
  //     debugger;
  //     // contained=true,
  //     // 5186327 2/2 51b aligned read. (chrM:10427-10477)
  //     // return bam.getAlignmentsInRange(range, false).then(alignments => {
  //     //   // contained=false
  //     //   // 5186327 1/2 51b aligned read. (chrM:10388-10438)
  //     //   // 5186327 2/2 51b aligned read. (chrM:10427-10477)
  //     //   done();
  //     // });
  //   }).done();
  // });

  it('should fetch alignments from a Chunk', function(done) {
    var bam = new Bam(new RemoteFile('/test/data/index_test.bam'));
    bam.readChunk(new VirtualOffset(0, 8384),
                  new VirtualOffset(0, 11194)).then(alignments => {
      expect(alignments).to.have.length(21);
      expect(alignments[0].refID).to.equal(0);
      expect(alignments[0].pos).to.equal(1518);
      expect(alignments[20].refID).to.equal(0);
      expect(alignments[20].pos).to.equal(15568);
      done();
    }).done();
  });

  it('should fetch alignments to the end of a block', function(done) {
    var bam = new Bam(new RemoteFile('/test/data/index_test.bam'));
    bam.readChunk(new VirtualOffset(0, 8384)).then(alignments => {
      expect(alignments).to.have.length(426);
      expect(alignments[0].refID).to.equal(0);
      expect(alignments[0].pos).to.equal(1518);
      expect(alignments[20].refID).to.equal(0);
      expect(alignments[20].pos).to.equal(15568);
      expect(alignments[425].refID).to.equal(1);
      expect(alignments[425].pos).to.equal(111620369);
      done();
    }).done();
  });

  /*
  it('should handle ginormous files', function(done) {
    this.timeout(5000);
    var bamFile = new Bam(new RemoteFile('/chrM.sorted.bam'));
    bamFile.readAll(true).then(bamData => {
      expect(bamData.alignments).to.have.length(38461);
      done();
    }).done();
  });
  */
});

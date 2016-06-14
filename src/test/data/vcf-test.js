/* @flow */
'use strict';

import {expect} from 'chai';

import VcfFile from '../../main/data/vcf';
import ContigInterval from '../../main/ContigInterval';
import RemoteFile from '../../main/RemoteFile';
import LocalStringFile from '../../main/LocalStringFile';

describe('VCF', function() {
  it('should respond to queries', function() {
    var vcf = new VcfFile(new RemoteFile('/test-data/snv.vcf'));
    var range = new ContigInterval('20', 63799, 69094);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features).to.have.length(6);

      var v0 = features[0],
          v5 = features[5];

      expect(v0.contig).to.equal('20');
      expect(v0.position).to.equal(63799);
      expect(v0.ref).to.equal('C');
      expect(v0.alt).to.equal('T');

      expect(v5.contig).to.equal('20');
      expect(v5.position).to.equal(69094);
      expect(v5.ref).to.equal('G');
      expect(v5.alt).to.equal('A');
    });
  });

  it('should add chr', function() {
    var vcf = new VcfFile(new RemoteFile('/test-data/snv.vcf'));
    var range = new ContigInterval('chr20', 63799, 69094);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features).to.have.length(6);
      expect(features[0].contig).to.equal('20');  // not chr20
      expect(features[5].contig).to.equal('20');
    });
  });

  it('should handle unsorted VCFs', function() {
    var vcf = new VcfFile(new RemoteFile('/test-data/sort-bug.vcf'));
    var chr1 = new ContigInterval('chr1', 1, 1234567890),  // all of chr1
        chr5 = new ContigInterval('chr5', 1, 1234567890);
    return vcf.getFeaturesInRange(chr1).then(features => {
      expect(features).to.have.length(5);
      return vcf.getFeaturesInRange(chr5);
    }).then(features => {
      expect(features).to.have.length(5);
    });
  });
});
describe('VCF from string content', function() {
  var content = '';
  before(function() {
    content = 
"##fileformat=VCFv4.1\n"+
"##source=VarScan2\n"+
"##INFO=<ID=DP,Number=1,Type=Integer,Description=\"Total depth of quality bases\">\n"+
"##INFO=<ID=SOMATIC,Number=0,Type=Flag,Description=\"Indicates if record is a somatic mutation\">\n"+
"##INFO=<ID=SS,Number=1,Type=String,Description=\"Somatic status of variant (0=Reference,1=Germline,2=Somatic,3=LOH, or 5=Unknown)\">\n"+
"##INFO=<ID=SSC,Number=1,Type=String,Description=\"Somatic score in Phred scale (0-255) derived from somatic p-value\">\n"+
"##INFO=<ID=GPV,Number=1,Type=Float,Description=\"Fisher's Exact Test P-value of tumor+normal versus no variant for Germline calls\">\n"+
"##INFO=<ID=SPV,Number=1,Type=Float,Description=\"Fisher's Exact Test P-value of tumor versus normal for Somatic/LOH calls\">\n"+
"##FILTER=<ID=str10,Description=\"Less than 10% or more than 90% of variant supporting reads on one strand\">\n"+
"##FILTER=<ID=indelError,Description=\"Likely artifact due to indel reads at this position\">\n"+
"##FORMAT=<ID=GT,Number=1,Type=String,Description=\"Genotype\">\n"+
"##FORMAT=<ID=GQ,Number=1,Type=Integer,Description=\"Genotype Quality\">\n"+
"##FORMAT=<ID=DP,Number=1,Type=Integer,Description=\"Read Depth\">\n"+
"##FORMAT=<ID=RD,Number=1,Type=Integer,Description=\"Depth of reference-supporting bases (reads1)\">\n"+
"##FORMAT=<ID=AD,Number=1,Type=Integer,Description=\"Depth of variant-supporting bases (reads2)\">\n"+
"##FORMAT=<ID=FREQ,Number=1,Type=String,Description=\"Variant allele frequency\">\n"+
"##FORMAT=<ID=DP4,Number=4,Type=Integer,Description=\"Strand read counts: ref/fwd, ref/rev, var/fwd, var/rev\">\n"+
"#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	NORMAL	TUMOR\n"+
"20	61795	.	G	T	.	PASS	DP=81;SS=1;SSC=2;GPV=4.6768E-16;SPV=5.4057E-1	GT:GQ:DP:RD:AD:FREQ:DP4	0/1:.:44:22:22:50%:16,6,9,13	0/1:.:37:18:19:51.35%:10,8,10,9\n"+
"20	62731	.	C	A	.	PASS	DP=68;SS=1;SSC=1;GPV=1.4855E-11;SPV=7.5053E-1	GT:GQ:DP:RD:AD:FREQ:DP4	0/1:.:32:17:15:46.88%:9,8,9,6	0/1:.:36:21:15:41.67%:8,13,8,7\n"+
"20	63799	.	C	T	.	PASS	DP=72;SS=1;SSC=7;GPV=3.6893E-16;SPV=1.8005E-1	GT:GQ:DP:RD:AD:FREQ:DP4	0/1:.:39:19:19:50%:8,11,11,8	0/1:.:33:12:21:63.64%:5,7,8,13\n"+
"20	65288	.	G	T	.	PASS	DP=35;SS=1;SSC=0;GPV=7.8434E-5;SPV=8.2705E-1	GT:GQ:DP:RD:AD:FREQ:DP4	0/1:.:21:13:8:38.1%:4,9,0,8	0/1:.:14:10:4:28.57%:2,8,0,4\n"+
"20	65900	.	G	A	.	PASS	DP=53;SS=1;SSC=0;GPV=1.5943E-31;SPV=1E0	GT:GQ:DP:RD:AD:FREQ:DP4	1/1:.:26:0:26:100%:0,0,12,14	1/1:.:27:0:27:100%:0,0,15,12\n"+
"20	66370	.	G	A	.	PASS	DP=66;SS=1;SSC=0;GPV=2.6498E-39;SPV=1E0	GT:GQ:DP:RD:AD:FREQ:DP4	1/1:.:32:0:32:100%:0,0,11,21	1/1:.:34:0:34:100%:0,0,15,19\n"+
"20	68749	.	T	C	.	PASS	DP=64;SS=1;SSC=0;GPV=4.1752E-38;SPV=1E0	GT:GQ:DP:RD:AD:FREQ:DP4	1/1:.:23:0:23:100%:0,0,7,16	1/1:.:41:0:41:100%:0,0,21,20\n"+
"20	69094	.	G	A	.	PASS	DP=25;SS=1;SSC=8;GPV=4.2836E-5;SPV=1.5657E-1	GT:GQ:DP:RD:AD:FREQ:DP4	0/1:.:12:8:4:33.33%:5,3,4,0	0/1:.:13:5:8:61.54%:3,2,6,2\n"+
"20	69408	.	C	T	.	PASS	DP=53;SS=1;SSC=0;GPV=8.7266E-12;SPV=9.8064E-1	GT:GQ:DP:RD:AD:FREQ:DP4	0/1:.:27:9:18:66.67%:5,4,9,9	0/1:.:26:15:11:42.31%:6,9,4,7\n"+
"20	75254	.	C	A	.	PASS	DP=74;SS=1;SSC=9;GPV=7.9203E-12;SPV=1.1567E-1	GT:GQ:DP:RD:AD:FREQ:DP4	0/1:.:34:22:11:33.33%:13,9,5,6	0/1:.:40:20:20:50%:5,15,14,6\n";
  });

  it('should respond to queries', function() {
    var vcf = new VcfFile(new LocalStringFile(content));
    var range = new ContigInterval('20', 63799, 69094);
    return vcf.getFeaturesInRange(range).then(features => {
      expect(features).to.have.length(6);

      var v0 = features[0],
          v5 = features[5];

      expect(v0.contig).to.equal('20');
      expect(v0.position).to.equal(63799);
      expect(v0.ref).to.equal('C');
      expect(v0.alt).to.equal('T');

      expect(v5.contig).to.equal('20');
      expect(v5.position).to.equal(69094);
      expect(v5.ref).to.equal('G');
      expect(v5.alt).to.equal('A');
    });
  });
});

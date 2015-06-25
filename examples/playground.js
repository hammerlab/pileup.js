var sources = [
  {
    viz: pileup.viz.genome(),
    isReference: true,
    data: pileup.formats.twoBit({
      url: 'http://www.biodalliance.org/datasets/hg19.2bit'
    }),
    name: 'Reference'
  },
  {
    viz: pileup.viz.variants(),
    data: pileup.formats.vcf({
      url: '/test-data/snv.chr17.vcf'
    }),
    name: 'Variants'
  },
  {
    viz: pileup.viz.genes(),
    data: pileup.formats.bigBed({
      url: 'http://www.biodalliance.org/datasets/ensGene.bb'
    }),
    name: 'Genes'
  },
  {
    viz: pileup.viz.pileup(),
    data: pileup.formats.bam({
      url: '/test-data/synth3.normal.17.7500000-7515000.bam',
      indexUrl: '/test-data/synth3.normal.17.7500000-7515000.bam.bai'
    }),
    cssClass: 'normal',
    name: 'Alignments'
  }
];

var p = pileup.create(yourDiv, {
  range: {contig: 'chr17', start: 7512384, stop: 7512544},
  tracks: sources
});

// This pileup shows some large deletions.

var bamSource = pileup.formats.bam({
  url: '/test-data/synth4.tumor.1.4930000-4950000.bam',
  indexUrl: '/test-data/synth4.tumor.1.4930000-4950000.bam.bai'
});

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
    viz: pileup.viz.scale(),
    name: 'Scale'
  },
  {
    viz: pileup.viz.location(),
    name: 'Location'
  },
  {
    viz: pileup.viz.coverage(),
    data: bamSource,
    name: 'synth4'
  },
  {
    viz: pileup.viz.pileup({
      viewAsPairs: true
    }),
    data: bamSource,
    name: 'synth4'
  }
];

var range = {contig: 'chr1', start: 4930382, stop: 4946898};

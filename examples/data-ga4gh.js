// Some data for the demo.

// We are going to use the same data source for multiple tracks
var bamSource = pileup.formats.bam({
  url: '/test-data/synth3.normal.17.7500000-7515000.bam',
  indexUrl: '/test-data/synth3.normal.17.7500000-7515000.bam.bai'
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
    viz: pileup.viz.genes(),
    data: pileup.formats.bigBed({
      url: 'http://www.biodalliance.org/datasets/ensGene.bb'
    }),
    name: 'Genes'
  },
  {
    viz: pileup.viz.variants(),
    data: pileup.formats.GAVariant({
        endpoint: 'http://1kgenomes.ga4gh.org',
        variantSetId: "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIl0",
        callSetIds: ["WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIiwiSEcwMDA5NiJd"],
        killChr: true
    }),
    options: {
      onVariantClicked: function(data) {
        var content = "Variants:\n";
        for (var i =0;i< data.length;i++) {
          content += `${data[i].id}: Ref: ${data[i].ref}, Alt: `;
          data[i].alt.forEach(alt => {
            content += `${alt} `;
          })
          content += '\n';
        }
        alert(content);
      },
    },
    name: 'Variants'
  },
  {
    viz: pileup.viz.features(),
    data: pileup.formats.GAFeature({
      endpoint: 'http://1kgenomes.ga4gh.org',
      featureSetId: "WyIxa2dlbm9tZXMiLCJnZW5jb2RlX3YyNGxpZnQzNyJd",
    }),
    name: 'Features'
  },
  // { TODO
  //   viz: pileup.viz.pileup(),
  //   data: pileup.formats.GAReadAlignment({
  //     endpoint: 'http://1kgenomes.ga4gh.org',
  //     readGroupId: "WyIxa2dlbm9tZXMiLCJyZ3MiLCJIRzAzMjcwIiwiRVJSMTgxMzI5Il0",
  //   }),
  //   name: 'Alignments'
  // }
];

var range = {contig: 'chr1', start: 120000, stop: 125000};

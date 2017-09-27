// Some data for the demo.

// We are going to use the same data source for multiple tracks
var bamSource = pileup.formats.bam({
  url: '/test-data/synth3.normal.17.7500000-7515000.bam',
  indexUrl: '/test-data/synth3.normal.17.7500000-7515000.bam.bai'
});

// This URL points to the GA4GH Reference Server, which
// can be accessed for examples of standardized endpoints
// for genomic data. All available GA4GH endpoints can
// be found here: http://1kgenomes.ga4gh.org
var ga4ghReferenceServer = 'http://1kgenomes.ga4gh.org';

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
        endpoint: ga4ghReferenceServer,
        variantSetId: "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIl0",
        callSetIds: ["WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIiwiSEcwMDA5NiJd"]
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
    name: 'Phase3 Release Variants'
  },
  {
    viz: pileup.viz.features(),
    data: pileup.formats.GAFeature({
      endpoint: ga4ghReferenceServer,
      featureSetId: "WyIxa2dlbm9tZXMiLCJnZW5jb2RlX3YyNGxpZnQzNyJd"
    }),
    name: 'gencode_v24lift37'
  },
  {
    viz: pileup.viz.coverage(),
    data: pileup.formats.GAReadAlignment({
      endpoint: ga4ghReferenceServer,
      readGroupId: "WyIxa2dlbm9tZXMiLCJyZ3MiLCJOQTEyODc4IiwiU1JSNjIyNDYxIl0",
      forcedReferenceId: "WyJOQ0JJMzciLCIxIl0"
    }),
    cssClass: 'normal',
    name: 'Coverage'
  },
  {
    viz: pileup.viz.pileup(),
    data: pileup.formats.GAReadAlignment({
      endpoint: ga4ghReferenceServer,
      readGroupId: "WyIxa2dlbm9tZXMiLCJyZ3MiLCJOQTEyODc4IiwiU1JSNjIyNDYxIl0",
      forcedReferenceId: "WyJOQ0JJMzciLCIxIl0"
    }),
    cssClass: 'normal',
    name: 'NA12878'
  }
];

var range = {contig: 'chr1', start: 120000, stop: 125000};

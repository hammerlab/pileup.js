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
  // {
  //   viz: pileup.viz.coverage(),
  //   data: bamSource,
  //   cssClass: 'normal',
  //   name: 'Coverage'
  // },
  // {
  //   viz: pileup.viz.pileup(),
  //   data: bamSource,
  //   cssClass: 'normal',
  //   name: 'Alignments'
  // },
  // {
  //   viz: pileup.viz.coverage(),
  //   data: bamSource,
  //   cssClass: 'tumor',
  //   name: 'Coverage'
  // },
  {
    viz: pileup.viz.pileup({
      viewAsPairs: true
    }),
    data: bamSource,
    cssClass: 'tumor',
    name: 'Alignments'
  }
];

// Try to read a range out of the URL. This is helpful for testing.
function getParameterByName(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
  return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
var pos = getParameterByName('pos');

var range;
if (pos) {
  var m = /(.*):([0-9,]+)-([0-9,]+)/.exec(pos);
  if (!m) { throw 'Invalid range: ' + pos; }
  var makeNum = function(x) { return Number(x.replace(/,/g, '')); };
  range = {contig: m[1], start: makeNum(m[2]), stop: makeNum(m[3])};
} else {
  range = {contig: 'chr17', start: 7512284, stop: 7512644};
}

var p = pileup.create(yourDiv, {
  range: range,
  tracks: sources
});

function jiggle() {
  var r = p.getRange();
  if (r.start % 10 == 0) {
    r.start -= 9;
    r.stop -= 9;
  } else {
    r.start += 1;
    r.stop += 1;
  }

  p.setRange(r);
}

var isJiggling = false;
document.getElementById('jiggle').onclick = function() {
  if (isJiggling) {
    isJiggling = false;
    this.innerHTML = 'FPS test';
    return;
  }

  var repeatedlyJiggle = function() {
    jiggle();
    if (isJiggling) {
      window.requestAnimationFrame(repeatedlyJiggle);
    }
  };

  isJiggling = true;
  this.innerHTML = 'Stop!';
  repeatedlyJiggle();
};

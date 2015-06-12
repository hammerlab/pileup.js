/* @flow */
'use strict';

var expect = require('chai').expect;

var pileup = require('pileup'),
    {waitFor} = require('./async');


describe('pileup', function() {
  var tracks = [
    {
      viz: pileup.viz.genome(),
      isReference: true,
      data: pileup.formats.twoBit({
        url: '/test/data/test.2bit'
      }),
      cssClass: 'a'
    },
    {
      viz: pileup.viz.variants(),
      data: pileup.formats.vcf({
        url: '/test/data/snv.chr17.vcf'
      }),
      cssClass: 'b'
    },
    {
      viz: pileup.viz.genes(),
      data: pileup.formats.bigBed({
        // This file contains just TP53, shifted so that it starts at the
        // beginning of chr17 (to match test.2bit). See test/data/README.md.
        url: '/test/data/tp53.shifted.bb'
      }),
      cssClass: 'c'
    },
    {
      viz: pileup.viz.pileup(),
      data: pileup.formats.bam({
        url: '/test/data/chr17.1-250.bam',
        indexUrl: '/test/data/chr17.1-250.bam.bai'
      }),
      cssClass: 'd'
    }
  ];

  var testDiv = document.getElementById('testdiv');

  afterEach(function() {
    testDiv.innerHTML = '';  // avoid pollution between tests.
  });

  it('should render reference genome and genes', function() {
    this.timeout(5000);

    var div = document.createElement('div');
    div.setAttribute('style', 'width: 800px; height: 200px;');
    testDiv.appendChild(div);

    var p = pileup.create(div, {
      range: {contig: 'chr17', start: 100, stop: 150},
      tracks: tracks
    });

    var ready = (() => 
      div.querySelectorAll('.basepair').length > 0 &&
      div.querySelectorAll('.gene').length > 0 &&
      div.querySelectorAll('.alignment').length > 0
    );

    return waitFor(ready, 5000)
      .then(() => {
        var basepairs = div.querySelectorAll('.basepair');
        expect(basepairs).to.have.length.at.least(10);
        var geneNames = div.querySelectorAll('.gene text');
        expect(geneNames.length).to.equal(1);
        expect(geneNames[0].textContent).to.equal('TP53');

        // Note: there are 11 exons, but two are split into coding/non-coding
        expect(div.querySelectorAll('.gene .exon').length).to.equal(13);

        expect(div.querySelector('div > .a').className).to.equal('reference a');
        expect(div.querySelector('div > .b').className).to.equal('variants b');
        expect(div.querySelector('div > .c').className).to.equal('genes c');
        expect(div.querySelector('div > .d').className).to.equal('pileup d');

        expect(p.getRange()).to.deep.equal({
          contig: 'chr17',
          start: 100,
          stop: 150
        });

        // This tests the workaround for https://github.com/facebook/react/issues/1939
        // See react-shim.js for details.
        expect(div.querySelectorAll('[data-pileupid]')).to.have.length.above(0);
        expect(div.querySelectorAll('[data-reactid]')).to.have.length(0);
      });
  });
});

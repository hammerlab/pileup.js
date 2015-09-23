/* @flow */
'use strict';

var expect = require('chai').expect;

var pileup = require('../main/pileup'),
    {waitFor} = require('./async'),
    dataCanvas = require('../main/data-canvas'),
    _ = require('underscore');

describe('pileup', function() {
  var tracks = [
    {
      viz: pileup.viz.genome(),
      isReference: true,
      data: pileup.formats.twoBit({
        url: '/test-data/test.2bit'
      }),
      cssClass: 'a'
    },
    {
      viz: pileup.viz.variants(),
      data: pileup.formats.vcf({
        url: '/test-data/snv.chr17.vcf'
      }),
      cssClass: 'b'
    },
    {
      viz: pileup.viz.genes(),
      data: pileup.formats.bigBed({
        // This file contains just TP53, shifted so that it starts at the
        // beginning of chr17 (to match test.2bit). See test/data/README.md.
        url: '/test-data/tp53.shifted.bb'
      }),
      cssClass: 'c'
    },
    {
      viz: pileup.viz.scale(),
      data: pileup.formats.empty(),
      name: 'Scale'
    },
    {
      viz: pileup.viz.location(),
      data: pileup.formats.empty(),
      name: 'Location'
    },
    {
      viz: pileup.viz.pileup(),
      data: pileup.formats.bam({
        url: '/test-data/chr17.1-250.bam',
        indexUrl: '/test-data/chr17.1-250.bam.bai'
      }),
      cssClass: 'd'
    }
  ];

  var testDiv = document.getElementById('testdiv');

  // These are helpers for working with RecordingContext.
  var origGetDataContext = dataCanvas.getDataContext,
      recorders = [];

  function recorderForCanvas(canvas) {
    var pair = _.find(recorders, r => r[0] == canvas);
    if (pair) return pair[1];
    return null;
  }

  function recorderForSelector(div, selector) {
    var canvas = div.querySelector(selector + ' canvas');
    if (!canvas) return null;
    return recorderForCanvas(canvas);
  }

  // Find objects drawn on a particular recorded canvas
  function drawnObjectsWith(div, selector, predicate) {
    var recorder = recorderForSelector(div, selector);
    return recorder ? recorder.drawnObjectsWith(predicate) : [];
  }

  // Find calls of particular drawing functions (e.g. fillText)
  function callsOf(div, selector, type) {
    var recorder = recorderForSelector(div, selector);
    return recorder ? recorder.callsOf(type) : [];
  }

  beforeEach(() => {
    recorders = [];
    dataCanvas.getDataContext = function(ctx) {
      var recorder = recorderForCanvas(ctx.canvas);
      if (recorder) return recorder;

      recorder = new dataCanvas.RecordingContext(ctx);
      recorders.push([ctx.canvas, recorder]);
      return recorder;
    };
  });

  afterEach(function() {
    testDiv.innerHTML = '';  // avoid pollution between tests.
    dataCanvas.getDataContext = origGetDataContext;
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
      drawnObjectsWith(div, '.genes', x => x.name).length > 0 &&
      drawnObjectsWith(div, '.pileup', x => x.span).length > 0
    );

    return waitFor(ready, 5000)
      .then(() => {
        var basepairs = div.querySelectorAll('.basepair');
        expect(basepairs).to.have.length.at.least(10);

        var geneTexts = callsOf(div, '.genes', 'fillText');
        expect(geneTexts).to.have.length(1);
        expect(geneTexts[0][1]).to.equal('TP53');

        // Note: there are 11 exons, but two are split into coding/non-coding
        expect(callsOf(div, '.genes', 'fillRect')).to.have.length(13);

        expect(div.querySelector('div > .a').className).to.equal('track reference a');
        expect(div.querySelector('div > .b').className).to.equal('track variants b');
        expect(div.querySelector('div > .c').className).to.equal('track genes c');
        expect(div.querySelector('div > .d').className).to.equal('track pileup d');

        // Four read groups are visible
        expect(drawnObjectsWith(div, '.pileup', x => x.span)).to.have.length(4);

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

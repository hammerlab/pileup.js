/* @flow */
'use strict';

import {expect} from 'chai';

import _ from 'underscore';
import dataCanvas from 'data-canvas';

import pileup from '../main/pileup';
import ContigInterval from '../main/ContigInterval';
import {waitFor} from './async';
    
describe('pileup', function() {
  var tracks = [
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
      viz: pileup.viz.pileup(),
      data: pileup.formats.bam({
        url: '/test-data/chr17.1-250.bam',
        indexUrl: '/test-data/chr17.1-250.bam.bai'
      }),
      cssClass: 'd'
    }
  ];

  var testDiv = document.getElementById('testdiv');
  if (!testDiv) throw new Error("Failed to match: testdiv");

  beforeEach(() => {
    dataCanvas.RecordingContext.recordAll();  // record all data canvases
  });

  afterEach(function() {
    dataCanvas.RecordingContext.reset();
    testDiv.innerHTML = '';  // avoid pollution between tests.
  });

  it('should render reference genome and genes', function(): any {
    this.timeout(5000);

    var div = document.createElement('div');
    div.setAttribute('style', 'width: 800px; height: 200px;');
    testDiv.appendChild(div);

    var p = pileup.create(div, {
      range: {contig: 'chr17', start: 100, stop: 150},
      tracks: tracks
    });

    var {drawnObjects, drawnObjectsWith, callsOf} = dataCanvas.RecordingContext;

    var uniqDrawnObjectsWith = function(div: any, name: string, f: any) {
      return _.uniq(
          drawnObjectsWith(div, name, f),
          false,  // not sorted
          x => x.key);
    };

    // TODO: consider moving this into the data-canvas library
    function hasCanvasAndObjects(div, selector) {
      return div.querySelector(selector + ' canvas') && drawnObjects(div, selector).length > 0;
    }

    var ready = ((): boolean =>
      // $FlowIgnore: TODO remove flow suppression
      hasCanvasAndObjects(div, '.reference') &&
      hasCanvasAndObjects(div, '.variants') &&
      hasCanvasAndObjects(div, '.genes') &&
      hasCanvasAndObjects(div, '.pileup')
    );

    return waitFor(ready, 5000)
      .then(() => {
        var basepairs = drawnObjectsWith(div, '.reference', x => x.letter);
        expect(basepairs).to.have.length.at.least(10);

        var variants = drawnObjectsWith(div, '.variants', x => x.alt);
        expect(variants).to.have.length(1);
        expect(variants[0].position).to.equal(125);
        expect(variants[0].ref).to.equal('G');
        expect(variants[0].alt).to.equal('T');

        var geneTexts = callsOf(div, '.genes', 'fillText');
        expect(geneTexts).to.have.length(1);
        expect(geneTexts[0][1]).to.equal('TP53');

        // Note: there are 11 exons, but two are split into coding/non-coding
        expect(callsOf(div, '.genes', 'fillRect')).to.have.length(13);

        // check for reference
        var selectedClass = div.querySelector('div > .a');
        expect(selectedClass).to.not.be.null;
        if (selectedClass != null) {
          expect(selectedClass.className).to.equal('track reference a');
        }

        // check for variants
        selectedClass = div.querySelector('div > .b');
        expect(selectedClass).to.not.be.null;
        if (selectedClass != null) {
          expect(selectedClass.className).to.equal('track variants b');
        }

        // check for genes
        selectedClass = div.querySelector('div > .c');
        expect(selectedClass).to.not.be.null;
        if (selectedClass != null) {
          expect(selectedClass.className).to.equal('track genes c');
        }

        // check for pileup
        selectedClass = div.querySelector('div > .d');
        expect(selectedClass).to.not.be.null;
        if (selectedClass != null) {
          expect(selectedClass.className).to.equal('track pileup d');
        }

        expect(p.getRange()).to.deep.equal({
          contig: 'chr17',
          start: 100,
          stop: 150
        });

        // Four read groups are visible.
        // Due to tiling, some rendered reads may be off-screen.
        var range = p.getRange();
        var cRange = new ContigInterval(range.contig, range.start, range.stop);
        var visibleReads = uniqDrawnObjectsWith(div, '.pileup', x => x.span)
              .filter(x => x.span.intersects(cRange));
        expect(visibleReads).to.have.length(4);

        p.destroy();
      });
  });
});

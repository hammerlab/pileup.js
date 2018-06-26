/* @flow */
'use strict';

import {expect} from 'chai';
import dataCanvas from 'data-canvas';

import pileup from '../main/pileup';
import {waitFor} from './async';

describe('pileup-bigBed', function() {
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
        viz: pileup.viz.genes(),
        data: pileup.formats.bigBed({
          // This file contains the beginning of chr17 with only chr, start, stop.
          // See test/data/README.md.
          url: '/test-data/simple17.bb'
        }),
        name: "simple17",
        cssClass: 'b'
      }
    ];
  
    var testDiv = document.getElementById('testdiv');
  
    beforeEach(() => {
      dataCanvas.RecordingContext.recordAll();  // record all data canvases
    });
  
    afterEach(function() {
      dataCanvas.RecordingContext.reset();
      testDiv.innerHTML = '';  // avoid pollution between tests.
    });
  
    it('should render reference genome and genes', function() {
      this.timeout(5000);
  
      var div = document.createElement('div');
      div.setAttribute('style', 'width: 800px; height: 200px;');
      testDiv.appendChild(div);
  
      var p = pileup.create(div, {
        range: {contig: 'chr17', start: 20391, stop: 20591},
        tracks: tracks
      });
  
      var {drawnObjects, drawnObjectsWith, callsOf} = dataCanvas.RecordingContext;
  
      // TODO: consider moving this into the data-canvas library
      function hasCanvasAndObjects(div, selector) {
        return div.querySelector(selector + ' canvas') && drawnObjects(div, selector).length > 0;
      }
  
      var ready = (() =>
        hasCanvasAndObjects(div, '.reference') &&
        hasCanvasAndObjects(div, '.genes')
      );
  
      return waitFor(ready, 5000)
        .then(() => {
          var basepairs = drawnObjectsWith(div, '.reference', x => x.letter);
          expect(basepairs).to.have.length.at.least(10);
  
          var geneTexts = callsOf(div, '.genes', 'fillText');
          expect(geneTexts).to.have.length(1);
          expect(geneTexts[0][1]).to.equal('chr17:5821-31270');
  
          // Note: there are no exons in simple bed
          expect(callsOf(div, '.genes', 'fillRect')).to.have.length(0);
  
          expect(div.querySelector('div > .a').className).to.equal('track reference a');
          expect(div.querySelector('div > .b').className).to.equal('track genes b');
  
          expect(p.getRange()).to.deep.equal({
            contig: 'chr17',
            start: 20391,
            stop: 20591
          });
        
          p.destroy();
        });
    });
  });
  
/**
 * This tests whether feature information is being shown/drawn correctly
 * in the track.
 *
 * @flow
 */
'use strict';

import pileup from '../../main/pileup';
import dataCanvas from 'data-canvas';
import {waitFor} from '../async';
import {expect} from 'chai';
import RemoteFile from '../../main/RemoteFile';

describe('IdiogramTrack', function() {
  var testDiv= document.getElementById('testdiv');
  if (!testDiv) throw new Error("Failed to match: testdiv");

  var drawnObjects = dataCanvas.RecordingContext.drawnObjects;

  function ready(): boolean {
      return testDiv.querySelector('.idiogram canvas') !== null &&
          testDiv.querySelector('.idiogram canvas') !== undefined &&
          drawnObjects(testDiv, '.idiogram').length > 0;
  }

  beforeEach(() => {
    testDiv.style.width = '800px';
    dataCanvas.RecordingContext.recordAll();
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
    // avoid pollution between tests.
    testDiv.innerHTML = '';
  });

  describe('json features', function() {
    var json;

    before(function(): any {
      return new RemoteFile('/test-data/gstained_chromosomes_data.json').getAllString().then(data => {
        json = data;
      });
    });

    it('should render idiogram with json', function(): any {
      var p = pileup.create(testDiv, {
        range: {contig: 'chr17', start: 7500000, stop: 7500500},
        tracks: [
          {
            viz: pileup.viz.genome(),
            data: pileup.formats.twoBit({
              url: '/test-data/test.2bit'
            }),
            isReference: true
          },
          {
            viz: pileup.viz.idiogram(),
            data: pileup.formats.idiogramJson(json),
            name: 'Idiogram'
          }
        ]
      });

      return waitFor(ready, 2000)
        .then(() => {
          var bands = drawnObjects(testDiv, '.idiogram');
          expect(bands).to.have.length(24);
          p.destroy();
        });
    });
  });

  describe('cytoband features', function() {

    it('should render idiogram with gzipped file', function(): any {
      var p = pileup.create(testDiv, {
        range: {contig: 'chr1', start: 7500000, stop: 7500500},
        tracks: [
          {
            viz: pileup.viz.genome(),
            data: pileup.formats.twoBit({
              url: '/test-data/test.2bit'
            }),
            isReference: true
          },
          {
            viz: pileup.viz.idiogram(),
            data: pileup.formats.cytoBand('/test-data/cytoBand.txt.gz'),
            name: 'Idiogram'
          }
        ]
      });

      return waitFor(ready, 2000)
        .then(() => {
          var bands = drawnObjects(testDiv, '.idiogram');
          expect(bands).to.have.length(63);
          p.destroy();
        });
    });

  });
});

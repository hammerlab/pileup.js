/**
 * This tests whether feature information is being shown/drawn correctly
 * in the track.
 *
 * @flow
 */
'use strict';

import {expect} from 'chai';

import _ from 'underscore';
import RemoteFile from '../../main/RemoteFile';
import pileup from '../../main/pileup';
import dataCanvas from 'data-canvas';
import {waitFor} from '../async';

import {yForRow} from '../../main/viz/pileuputils';

import ReactTestUtils from 'react-addons-test-utils';

describe('FeatureTrack', function() {
  var testDiv= document.getElementById('testdiv');
  if (!testDiv) throw new Error("Failed to match: testdiv");

  var drawnObjects = dataCanvas.RecordingContext.drawnObjects;

  function ready(): boolean {
      return testDiv.querySelector('.features canvas') !== null &&
          testDiv.querySelector('.features canvas') !== undefined &&
          drawnObjects(testDiv, '.features').length > 0;
  }

  describe('jsonFeatures', function() {
    var json;

    beforeEach(() => {
      testDiv.style.width = '800px';
      dataCanvas.RecordingContext.recordAll();
    });

    afterEach(() => {
      dataCanvas.RecordingContext.reset();
      // avoid pollution between tests.
      testDiv.innerHTML = '';
    });

    before(function(): any {
      return new RemoteFile('/test-data/features.ga4gh.chr1.120000-125000.json').getAllString().then(data => {
        json = data;
      });
    });

    it('should render features with json', function(): any {
      var featureClickedData = null;
      var featureClicked = function(data) {
        featureClickedData = data;
      };

      var p = pileup.create(testDiv, {
        range: {contig: 'chr1', start: 130000, stop: 135000},
        tracks: [
          {
            viz: pileup.viz.genome(),
            data: pileup.formats.twoBit({
              url: '/test-data/test.2bit'
            }),
            isReference: true
          },
          {
            viz: pileup.viz.features(),
            data: pileup.formats.featureJson(json),
            options: {onFeatureClicked: featureClicked},
          }
        ]
      });

      return waitFor(ready, 2000)
        .then(() => {
          var features = drawnObjects(testDiv, '.features');
          // there can be duplicates in the case where features are
          // overlapping  more than one section of the canvas
          features =  _.uniq(features, false, function(x) {
              return x.position.start();
          });

          expect(features).to.have.length(4);
          expect(features.map(f => f.position.start())).to.deep.equal(
              [89295, 92230, 110953, 120725]);

          var height = Math.round(yForRow(4) * window.devicePixelRatio); // should be 4 rows
          features = testDiv.querySelector('.features');
          expect(features).to.not.be.null;
          if (features != null) {
            expect(features.style.height).to.equal(`${height}px`);
          }

          // check clicking on feature
          var canvasList =  testDiv.getElementsByTagName('canvas');
          var canvas = canvasList[1];
          expect(featureClickedData).to.be.null;
          ReactTestUtils.Simulate.click(canvas,{nativeEvent: {offsetX: 430, offsetY: 50 * window.devicePixelRatio}});
          expect(featureClickedData).to.not.be.null;

          p.destroy();
        });
    });
  });

  describe('bigBedFeatures', function() {

    beforeEach(() => {
      testDiv.style.width = '800px';
      dataCanvas.RecordingContext.recordAll();
    });

    afterEach(() => {
      dataCanvas.RecordingContext.reset();
      // avoid pollution between tests.
      testDiv.innerHTML = '';
    });

    it('should render features with bigBed file', function(): any {

      var p = pileup.create(testDiv, {
        range: {contig: 'chr17', start: 10000, stop: 16500},
        tracks: [
          {
            viz: pileup.viz.genome(),
            data: pileup.formats.twoBit({
              url: '/test-data/test.2bit'
            }),
            isReference: true
          },
          {
            viz: pileup.viz.features(),
            data: pileup.formats.bigBed({
              url: '/test-data/chr17.22.10000-21000.bb',
            }),
            name: 'Features'
          }
        ]
      });


      return waitFor(ready, 2000).then(() => {
          var features = drawnObjects(testDiv, '.features');
          // there can be duplicates in the case where features are
          // overlapping  more than one section of the canvas
          features =  _.uniq(features, false, function(x) {
              return x.position.start();
          });

          expect(features).to.have.length.at.least(2);
          
          p.setRange({contig: 'chr22', start: 20000, stop: 21000});
      }).delay(300).then(() => {
        var features = drawnObjects(testDiv, '.features');
        // there can be duplicates in the case where features are
        // overlapping  more than one section of the canvas
        features =  _.uniq(features, false, function(x) {
            return x.position.start();
        });

        expect(features).to.have.length(10);

        // canvas height should be maxed out, should not exceed parent height limits
        var expectedHeight = Math.round(150 * window.devicePixelRatio);
        var featureCanvas = testDiv.querySelector('.features');
        expect(featureCanvas).to.not.be.null;
        if (featureCanvas != null) {
          expect(featureCanvas.style.height).to.equal(`${expectedHeight}px`);
        }
        p.destroy();
      });
    });
  });
});

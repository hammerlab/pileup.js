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

describe('FeatureTrack', function() {
  var testDiv = document.getElementById('testdiv');
  var range = {contig: 'chr1', start: 130000, stop: 135000};
  var json;

  beforeEach(() => {
    testDiv.style.width = '800px';
    dataCanvas.RecordingContext.recordAll();
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
  });

  before(function () {
    return new RemoteFile('/test-data/features.ga4gh.chr1.120000-125000.json').getAllString().then(data => {
      json = data;
    });
  });

  var drawnObjects = dataCanvas.RecordingContext.drawnObjects;

  function ready() {
    return testDiv.querySelector('canvas') &&
       drawnObjects(testDiv, '.features').length > 0;
  }

  it('should render features with json', function() {

    var p = pileup.create(testDiv, {
      range: range,
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
          data: pileup.formats.featureJson(json)
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
        p.destroy();
      });
  });

  it('should render features with bigBed file', function() {

    var p = pileup.create(testDiv, {
      range: {contig: 'chr17', start: 10000, stop: 10500},
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
            url: '/test-data/chr17.10000-100000.bb'
          }),
          name: 'Features'
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

        expect(features).to.have.length(3);
        expect(features.map(f => f.position.start())).to.deep.equal(
            [10000, 10200, 10400]);
        p.destroy();
      });
  });

});

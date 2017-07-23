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
       drawnObjects(testDiv, '.features').length > 2;
  }

  it('should render features', function() {

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
            return x.start;
        });

        expect(features).to.have.length(4);
        expect(features.map(f => f.start)).to.deep.equal(
            ["89295", "92230", "110953", "120725"]);
        p.destroy();
      });
  });

});

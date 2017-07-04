/**
 * This tests whether feature information is being shown/drawn correctly
 * in the track.
 *
 * @flow
 */
'use strict';

import {expect} from 'chai';

import sinon from 'sinon';

import RemoteFile from '../../main/RemoteFile';
import pileup from '../../main/pileup';
import dataCanvas from 'data-canvas';
import {waitFor} from '../async';

describe('FeatureTrack', function() {
  var testDiv = document.getElementById('testdiv');
  var range = {contig: 'chr1', start: 900, stop: 1500};
  var server: any = null, response;

  beforeEach(() => {
    testDiv.style.width = '800px';
    dataCanvas.RecordingContext.recordAll();
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
    // avoid pollution between tests.
    server.restore();
  });

  before(function () {
    return new RemoteFile('/test-data/features.ga4gh.chr1.120000-125000.json').getAllString().then(data => {
      server = sinon.fakeServer.create();
      response = data;
    });
  });

  after(function () {
    server.restore();
  });

  var drawnObjects = dataCanvas.RecordingContext.drawnObjects;

  function ready() {
    return testDiv.querySelector('canvas') &&
       drawnObjects(testDiv, '.features').length > 0;
  }

  it('should render features', function() {
    server.respondWith('POST', '/v0.6.0/features/search',
                       [200, { "Content-Type": "application/json" }, response]);

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
          data: pileup.formats.GAFeature({
            endpoint: '/v0.6.0',
            featureSetId: "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIl0"
          })
        }
      ]
    });


    return waitFor(ready, 2000)
      .then(() => {
        var features = drawnObjects(testDiv, '.features');
        var ids = ["4ee7469a-b468-429b-a109-07a484817037", "e105ce29-a840-4fc6-819f-a9aac5166163"];
        expect(features).to.have.length(2);
        expect(features.map(f => f.start)).to.deep.equal(
            [1107, 1011]);
        expect(features.map(g => g.id)).to.deep.equal(ids);
        p.destroy();
      });
  });

});

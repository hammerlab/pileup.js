/**
 * @flow
 */
'use strict';

import {expect} from 'chai';

import pileup from '../../main/pileup';
import dataCanvas from 'data-canvas';
import {waitFor} from '../async';

import ReactTestUtils from 'react-addons-test-utils';

describe('VariantTrack', function() {
  var testDiv = document.getElementById('testdiv');
  if (!testDiv) throw new Error("Failed to match: testdiv");

  beforeEach(() => {
    testDiv.style.width = '700px';
    dataCanvas.RecordingContext.recordAll();
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
    // avoid pollution between tests.
    testDiv.innerHTML = '';
  });
  var {drawnObjects} = dataCanvas.RecordingContext;

  function ready() {
    return testDiv.getElementsByTagName('canvas').length > 0 &&
        drawnObjects(testDiv, '.variants').length > 0;
  }

  it('should render variants', function(): any {
    var variantClickedData = null;
    var variantClicked = function(data) {
      variantClickedData = data;
    };
    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 9386380, stop: 9537390},
      tracks: [
        {
          viz: pileup.viz.genome(),
          data: pileup.formats.twoBit({
            url: '/test-data/test.2bit'
          }),
          isReference: true
        },
        {
          data: pileup.formats.vcf({
            url: '/test-data/test.vcf'
          }),
          viz: pileup.viz.variants(),
          options: {onVariantClicked: variantClicked},
        }
      ]
    });

    return waitFor(ready, 2000)
      .then(() => {
        var variants = drawnObjects(testDiv, '.variants');
        expect(variants.length).to.be.equal(1);
        var canvasList =  testDiv.getElementsByTagName('canvas');
        var canvas = canvasList[1];
        expect(variantClickedData).to.be.null;

        //check clicking on variant
        ReactTestUtils.Simulate.click(canvas,{nativeEvent: {offsetX: -0.5, offsetY: -15.5}});

        expect(variantClickedData).to.not.be.null;
        p.destroy();
      });
  });

});

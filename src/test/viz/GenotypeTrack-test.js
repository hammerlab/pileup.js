/**
 * This tests that the Controls and reference track render correctly, even when
 * an externally-set range uses a different chromosome naming system (e.g. '17'
 * vs 'chr17'). See https://github.com/hammerlab/pileup.js/issues/146
 * @flow
 */

'use strict';

import {expect} from 'chai';

import pileup from '../../main/pileup';
import dataCanvas from 'data-canvas';
import {waitFor} from '../async';

describe('GenotypeTrack', function() {
  var testDiv = document.getElementById('testdiv');
  if (!testDiv) throw new Error("Failed to match: testdiv");

  beforeEach(() => {
    testDiv.style.width = '800px';
    dataCanvas.RecordingContext.recordAll();
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
    // avoid pollution between tests.
    testDiv.innerHTML = '';
  });
  var drawnObjects = dataCanvas.RecordingContext.drawnObjects;

  function ready() {
    return testDiv.getElementsByTagName('canvas').length > 0 &&
        drawnObjects(testDiv, '.genotypes').length > 0;
  }

  it('should render genotypes', function(): any {
    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 9386380, stop: 9386390},
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
          viz: pileup.viz.genotypes(),
        }
      ]
    });

    return waitFor(ready, 2000)
      .then(() => {
        var labels = drawnObjects(testDiv, '.genotypeLabels');

        expect(labels).to.have.length(2);
        expect(labels).to.deep.equal(
            ["NORMAL", "TUMOR"]);

        var genotypes = drawnObjects(testDiv, '.genotypeRows');

        expect(genotypes).to.have.length(3);
        expect(genotypes[0]).to.deep.equal("NORMAL");
        expect(genotypes[1]).to.deep.equal("TUMOR");
        expect(genotypes[2].position).to.deep.equal(9386385);


        p.destroy();
      });
  });

});

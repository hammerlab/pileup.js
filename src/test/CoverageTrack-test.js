/**
 * This tests whether coverage information is being shown/drawn correctly
 * in the track. The alignment information comes from the test BAM files.
 *
 * @flow
 */
'use strict';

var expect = require('chai').expect;

import type * as SamRead from '../main/SamRead';

var pileup = require('../main/pileup'),
    TwoBit = require('../main/TwoBit'),
    TwoBitDataSource = require('../main/TwoBitDataSource'),
    MappedRemoteFile = require('./MappedRemoteFile'),
    dataCanvas = require('data-canvas'),
    _ = require('underscore'),
    {waitFor} = require('./async');

describe('CoverageTrack', function() {
  var testDiv = document.getElementById('testdiv');
  var range = {contig: '17', start: 7500730, stop: 7500790};
  var p;

  beforeEach(() => {
    dataCanvas.RecordingContext.recordAll();
    // A fixed width container results in predictable x-positions for mismatches.
    testDiv.style.width = '800px';
    p = pileup.create(testDiv, {
      range: range,
      tracks: [
        {
          data: referenceSource,
          viz: pileup.viz.genome(),
          isReference: true
        },
        {
          viz: pileup.viz.coverage(),
          data: pileup.formats.bam({
            url: '/test-data/synth3.normal.17.7500000-7515000.bam',
            indexUrl: '/test-data/synth3.normal.17.7500000-7515000.bam.bai'
          }),
          cssClass: 'tumor-coverage',
          name: 'Coverage'
        }
      ]
    });
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
    if (p) p.destroy();
    // avoid pollution between tests.
    testDiv.innerHTML = '';
    testDiv.style.width = '';
  });

  var twoBitFile = new MappedRemoteFile('/test-data/hg19.chr17.7500000-7501000.2bit.mapped',
                            [[0, 16383], [691179834, 691183928], [694008946, 694009197]]),
      referenceSource = TwoBitDataSource.createFromTwoBitFile(new TwoBit(twoBitFile));

  var {drawnObjectsWith, callsOf} = dataCanvas.RecordingContext;

  var findCoverageBins = () => {
    return drawnObjectsWith(testDiv, '.coverage', b => b.position && b.mismatches);
  };

  var findMismatchBins = ():Array<any> => {
    return drawnObjectsWith(testDiv, '.coverage', b => b.base);
  };


  var findCoverageLabels = () => {
    return drawnObjectsWith(testDiv, '.coverage', l => l.type == 'label');
  };

  var hasCoverage = () => {
    // Check whether the coverage bins are loaded yet
    return testDiv.querySelector('canvas') &&
        findCoverageBins().length > 1 &&
        findMismatchBins().length > 1 &&
        findCoverageLabels().length > 1;
  };

  it('should create coverage information for all bases shown in the view', function() {
    return waitFor(hasCoverage, 2000).then(() => {
      var bins = findCoverageBins();
      expect(bins).to.have.length.at.least(range.stop - range.start + 1);
    });
  });

  it('should show mismatch information', function() {
    return waitFor(hasCoverage, 2000).then(() => {
      var mbins = findMismatchBins();
      expect(mbins).to.have.length(12);
      var tMismatch = _.filter(mbins, mb => mb.position == 7500765)[0];
      expect(tMismatch.base).to.equal("T");
      expect(tMismatch.count).to.equal(22);
    });
  });

  it('should create correct labels for coverage', function() {
    return waitFor(hasCoverage, 2000).then(() => {
      // These are the objects being used to draw labels
      var labelTexts = findCoverageLabels();
      expect(labelTexts[0].label).to.equal('0X');
      expect(labelTexts[labelTexts.length-1].label).to.equal('50X');

      // Now let's test if they are actually being put on the screen
      var texts = callsOf(testDiv, '.coverage', 'fillText');
      expect(texts.map(t => t[1])).to.deep.equal(['0X', '25X', '50X']);
    });
  });

});

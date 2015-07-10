/**
 * This tests that pileup mismatches are rendered correctly, regardless of the
 * order in which the alignment and reference data come off the network.
 * @flow
 */
'use strict';

var expect = require('chai').expect;

var Q = require('q'),
    _ = require('underscore'),
    d3 = require('d3');

import type * as SamRead from '../main/SamRead';

var pileup = require('../main/pileup'),
    TwoBit = require('../main/TwoBit'),
    TwoBitDataSource = require('../main/TwoBitDataSource'),
    Bam = require('../main/bam'),
    BamDataSource = require('../main/BamDataSource'),
    RemoteFile = require('../main/RemoteFile'),
    MappedRemoteFile = require('./MappedRemoteFile'),
    ContigInterval = require('../main/ContigInterval'),
    {waitFor} = require('./async');

describe('CoverageTrack', function() {
  var testDiv = document.getElementById('testdiv');

  var testDiv = document.getElementById('testdiv');

  beforeEach(() => {
    // A fixed width container results in predictable x-positions for mismatches.
    testDiv.style.width = '800px';
  });

  afterEach(() => {
    // avoid pollution between tests.
    testDiv.innerHTML = '';
    testDiv.style.width = '';
  });

  var twoBitFile = new MappedRemoteFile('/test-data/hg19.chr17.7500000-7501000.2bit.mapped',
                            [[0, 16383], [691179834, 691183928], [694008946, 694009197]]),
      referenceSource = TwoBitDataSource.createFromTwoBitFile(new TwoBit(twoBitFile));

  var findCoverageBins = () => {
      return testDiv.querySelectorAll('.coverage .covbin');
  };

  var findCoverageBins = () => {
      return testDiv.querySelectorAll('.coverage .covbin');
  };

  var hasCoverage = () => {
    // Check whether the coverage bins are loaded yet
    return findCoverageBins().length > 0;
  };

  var testSetup = () => {
    var range = {contig: '17', start: 7500730, stop: 7500790};
    var p = pileup.create(testDiv, {
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
    return range;
  };

  it('should create coverage information for all bases shown in the view', function() {
    var range = testSetup();
    return waitFor(hasCoverage, 2000).then(() => {
      var bins = findCoverageBins();
      expect(bins).to.have.length.above(range.stop - range.start + 1);
    });
  });

  it('should create correct labels for coverage', function() {
    testSetup();
    return waitFor(hasCoverage, 2000).then(() => {
      var labelTexts = testDiv.querySelectorAll('.coverage .y-axis text');
      expect(labelTexts[0].innerHTML).to.equal('0X');
      expect(labelTexts[labelTexts.length-1].innerHTML).to.equal('50X');
    });
  });

});

/**
 * This tests whether coverage information is being shown/drawn correctly
 * in the track. The alignment information comes from the test BAM files.
 *
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
  var range = {contig: '17', start: 7500730, stop: 7500790};

  beforeEach(() => {
    // A fixed width container results in predictable x-positions for mismatches.
    testDiv.style.width = '800px';
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
    return testDiv.querySelectorAll('.coverage .bin');
  };

  var findCoverageLabels = () => {
    return testDiv.querySelectorAll('.coverage .y-axis text');
  };

  var hasCoverage = () => {
    // Check whether the coverage bins are loaded yet
    return findCoverageBins().length > 1 && findCoverageLabels().length > 1;
  };

  it('should create coverage information for all bases shown in the view', function() {
    return waitFor(hasCoverage, 2000).then(() => {
      var bins = findCoverageBins();
      expect(bins).to.have.length.above(range.stop - range.start + 1);
    });
  });

  it('should create correct labels for coverage', function() {
    return waitFor(hasCoverage, 2000).then(() => {
      var labelTexts = findCoverageLabels();
      expect(labelTexts[0].textContent).to.equal('0X');
      expect(labelTexts[labelTexts.length-1].textContent).to.equal('50X');
    });
  });

});

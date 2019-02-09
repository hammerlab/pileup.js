/**
 * This tests whether coverage information is being shown/drawn correctly
 * in the track. The alignment information comes from the test BAM files.
 *
 * @flow
 */
'use strict';

import {expect} from 'chai';

import sinon from 'sinon';

import pileup from '../../main/pileup';
import TwoBit from '../../main/data/TwoBit';
import TwoBitDataSource from '../../main/sources/TwoBitDataSource';
import MappedRemoteFile from '../MappedRemoteFile';
import RemoteFile from '../../main/RemoteFile';
import dataCanvas from 'data-canvas';
import {waitFor} from '../async';

describe('CoverageTrack', function() {
  var testDiv = document.getElementById('testdiv');
  if (!testDiv) throw new Error("Failed to match: testdiv");
  var range = {contig: '17', start: 7500730, stop: 7500790};

  var p;
  var server: any = null, response;

  before((): any => {
    // server for coverage features
    return new RemoteFile('/test-data/features.ga4gh.chr1.120000-125000.chr17.7500000-7515100.json').getAllString().then(data => {
      response = data;
      server = sinon.fakeServer.create();

      server.autoRespond = true;

      // Sinon should ignore 2bit request. RemoteFile handles this request.
      sinon.fakeServer.xhr.useFilters = true;
      sinon.fakeServer.xhr.addFilter(function (method, url) {
          return url === '/test-data/test.2bit';
      });
      sinon.fakeServer.xhr.addFilter(function (method, url) {
          return url === '/test-data/hg19.2bit.mapped';
      });
      sinon.fakeServer.xhr.addFilter(function (method, url) {
          return url === '/test-data/synth3.normal.17.7500000-7515000.bam';
      });
      sinon.fakeServer.xhr.addFilter(function (method, url) {
          return url === '/test-data/synth3.normal.17.7500000-7515000.bam.bai';
      });
    });
  });

  after(function(): any {
      server.restore();
  });

  beforeEach(() => {
    dataCanvas.RecordingContext.recordAll();
    // A fixed width container results in predictable x-positions for mismatches.
    testDiv.style.width = '800px';
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
    if (p) p.destroy();
    // avoid pollution between tests.
    testDiv.innerHTML = '';
    testDiv.style.width = '';
  });



  var twoBitFile = new MappedRemoteFile(
      '/test-data/hg19.2bit.mapped',
      [[0, 16383], [691179834, 691183928], [694008946, 694011447]]);
  var referenceSource = TwoBitDataSource.createFromTwoBitFile(new TwoBit(twoBitFile));

  var {drawnObjectsWith, callsOf} = dataCanvas.RecordingContext;

  var findCoverageBins = () => {
    return drawnObjectsWith(testDiv, '.coverage', b => b.count);
  };

  var findMismatchBins = ():Array<any> => {
    return drawnObjectsWith(testDiv, '.coverage', b => b.base);
  };

  var findCoverageLabels = () => {
    return drawnObjectsWith(testDiv, '.coverage', l => l.type == 'label');
  };

  function createAlignmentPileup() {
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
  }

  function createFeaturePileup() {
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
          data: pileup.formats.GAFeature({
            endpoint: '/v0.6.0',
            featureSetId: "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIl0",
          }),
          cssClass: 'tumor-coverage',
          name: 'FeatureCoverage'
        }
      ]
    });
  }

  var hasCoverage = (): boolean => {
    // Check whether the coverage bins are loaded yet
    return testDiv.querySelector('canvas') != null &&
        findCoverageBins().length > 1 &&
        findMismatchBins().length > 0 &&
        findCoverageLabels().length > 1;
  };

  var hasCoverageWithoutMismatches = (): boolean => {
    // Check whether the coverage bins are loaded yet
    return testDiv.querySelector('canvas') != null &&
        findCoverageBins().length > 1 &&
        findCoverageLabels().length > 1;
  };


  it('should create coverage information for all bases shown in the view', function(): any {
    createAlignmentPileup();
    return waitFor(hasCoverage, 2000).then(() => {
      var bins = findCoverageBins();
      expect(bins).to.have.length.at.least(range.stop - range.start + 1);
    });
  });

  it('should show mismatch information', function(): any {
    createAlignmentPileup();
    return waitFor(hasCoverage, 2000).then(() => {
      var visibleMismatches = findMismatchBins()
          .filter(bin => bin.position >= range.start && bin.position <= range.stop);
      expect(visibleMismatches).to.deep.equal(
        [{position: 7500765, count: 23, base: 'C'},
         {position: 7500765, count: 22, base: 'T'}]);
      // TODO: IGV shows counts of 20 and 20 at this locus. Whither the five reads?
      // `samtools view` reports the full 45 reads at 17:7500765
    });
  });

  it('should create correct labels for coverage', function(): any {
    createAlignmentPileup();
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

  it('should create coverage from features', function(): any {
    createFeaturePileup();
    server.respondWith('POST', '/v0.6.0/features/search',
                       [200, { "Content-Type": "application/json" }, response]);


    return waitFor(hasCoverageWithoutMismatches, 2000).then(() => {
      // These are the objects being used to draw labels
      var labelTexts = findCoverageLabels();
      expect(labelTexts[0].label).to.equal('0X');
      expect(labelTexts[labelTexts.length-1].label).to.equal('1X');

      // Now let's test if they are actually being put on the screen
      var texts = callsOf(testDiv, '.coverage', 'fillText');
      expect(texts.map(t => t[1])).to.deep.equal(['0X', '1X', '1X']);
    });

  });

});

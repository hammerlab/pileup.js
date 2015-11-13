/**
 * This tests that the Controls and reference track render correctly, even when
 * an externally-set range uses a different chromosome naming system (e.g. '17'
 * vs 'chr17'). See https://github.com/hammerlab/pileup.js/issues/146
 * @flow
 */

'use strict';

var expect = require('chai').expect;

var ReactTestUtils = require('react-addons-test-utils');

var pileup = require('../main/pileup'),
    TwoBit = require('../main/TwoBit'),
    TwoBitDataSource = require('../main/TwoBitDataSource'),
    dataCanvas = require('data-canvas'),
    MappedRemoteFile = require('./MappedRemoteFile'),
    {waitFor} = require('./async');

describe('GenomeTrack', function() {
  var testDiv = document.getElementById('testdiv');

  beforeEach(() => {
    // A fixed width container results in predictable x-positions for mismatches.
    testDiv.style.width = '800px';
    dataCanvas.RecordingContext.recordAll();
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
    // avoid pollution between tests.
    testDiv.innerHTML = '';
    testDiv.style.width = '';
  });

  var twoBitFile = new MappedRemoteFile(
          '/test-data/hg19.2bit.mapped',
          [[0, 16383], [691179834, 691183928], [694008946, 694011447]]),
      referenceSource = TwoBitDataSource.createFromTwoBitFile(new TwoBit(twoBitFile));

  var {drawnObjects} = dataCanvas.RecordingContext;
  var hasReference = () => {
      // The reference initially shows "unknown" base pairs, so we have to
      // check for a specific known one to ensure that it's really loaded.
      return testDiv.querySelector('canvas') &&
          drawnObjects(testDiv, '.reference').length > 0;
    };

  it('should tolerate non-chr ranges', function() {
    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 7500730, stop: 7500790},
      tracks: [
        {
          data: referenceSource,
          viz: pileup.viz.genome(),
          isReference: true
        }
      ]
    });

    return waitFor(hasReference, 2000).then(() => {
      // The contig selector should list have "chr" prefixes & an active selection.
      var options = testDiv.querySelectorAll('option');
      expect(options).to.have.length.above(20);
      expect(options[0].textContent).to.equal('chr1');
      var opt17 = (options[17]: any);
      expect(opt17.textContent).to.equal('chr17');
      expect(opt17.selected).to.be.true;
      expect(p.getRange()).to.deep.equal({
        contig: 'chr17',
        start: 7500730,
        stop: 7500790
      });
      p.destroy();
    });
  });

  var getInputs = function(selector): HTMLInputElement[] {
    var els = testDiv.querySelectorAll(selector);
    // note: this isn't really true, but it makes flow happy
    return ((els: any): HTMLInputElement[]);
  };

  it('should zoom in and out', function() {
    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 7500725, stop: 7500775},
      tracks: [
        {
          data: referenceSource,
          viz: pileup.viz.genome(),
          isReference: true
        }
      ]
    });

    expect(testDiv.querySelectorAll('.zoom-controls')).to.have.length(1);

    var buttons = testDiv.querySelectorAll('.controls button');
    var [goBtn, minusBtn, plusBtn] = buttons;
    var [locationTxt] = getInputs('.controls input[type="text"]');
    expect(goBtn.textContent).to.equal('Go');
    expect(minusBtn.className).to.equal('btn-zoom-out');
    expect(plusBtn.className).to.equal('btn-zoom-in');

    return waitFor(hasReference, 2000).then(() => {
      expect(locationTxt.value).to.equal('7,500,725-7,500,775');
      ReactTestUtils.Simulate.click(minusBtn);
    }).delay(50).then(() => {
      expect(p.getRange()).to.deep.equal({
        contig: 'chr17',
        start: 7500700,
        stop: 7500800
      });
      expect(locationTxt.value).to.equal('7,500,700-7,500,800');
      ReactTestUtils.Simulate.click(plusBtn);
    }).delay(50).then(() => {
      expect(p.getRange()).to.deep.equal({
        contig: 'chr17',
        start: 7500725,
        stop: 7500775
      });
      expect(locationTxt.value).to.equal('7,500,725-7,500,775');
      p.destroy();
    });
  });

  it('should accept user-entered locations', function() {
    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 7500725, stop: 7500775},
      tracks: [
        {
          data: referenceSource,
          viz: pileup.viz.genome(),
          isReference: true
        }
      ]
    });

    var [locationTxt] = getInputs('.controls input[type="text"]');
    var [goBtn] = testDiv.querySelectorAll('.controls button');
    expect(goBtn.textContent).to.equal('Go');

    return waitFor(hasReference, 2000).then(() => {
      expect(locationTxt.value).to.equal('7,500,725-7,500,775');
      locationTxt.value = '17:7500745-7500785';
      ReactTestUtils.Simulate.click(goBtn);
    }).delay(50).then(() => {
      expect(p.getRange()).to.deep.equal({
        contig: 'chr17',  // note: not '17'
        start: 7500745,
        stop: 7500785
      });
      expect(locationTxt.value).to.equal('7,500,745-7,500,785');
      p.destroy();
    });
  });
});

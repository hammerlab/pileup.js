/**
 * This tests that the Controls and reference track render correctly, even when
 * an externally-set range uses a different chromosome naming system (e.g. '17'
 * vs 'chr17'). See https://github.com/hammerlab/pileup.js/issues/146
 * @flow
 */

'use strict';

var expect = require('chai').expect;

var React = require('../main/react-shim');

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

  var twoBitFile = new MappedRemoteFile('/test-data/hg19.chr17.7500000-7501000.2bit.mapped',
                            [[0, 16383], [691179834, 691183928], [694008946, 694009197]]),
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

    var getInputs = function(selector): HTMLInputElement[] {
      var els = testDiv.querySelectorAll(selector);
      // note: this isn't really true, but it makes flow happy
      return ((els: any): HTMLInputElement[]);
    };

    expect(testDiv.querySelectorAll('.zoom-controls')).to.have.length(1);

    var buttons = testDiv.querySelectorAll('.controls button');
    var [goBtn, minusBtn, plusBtn] = buttons;
    var [startTxt, stopTxt] = getInputs('.controls input[type="text"]');
        // testDiv.querySelectorAll('.controls input[type="text"]');
    expect(goBtn.textContent).to.equal('Go');
    expect(minusBtn.className).to.equal('btn-zoom-out');
    expect(plusBtn.className).to.equal('btn-zoom-in');

    return waitFor(hasReference, 2000).then(() => {
      expect(startTxt.value).to.equal('7500725');
      expect(stopTxt.value).to.equal('7500775');
      React.addons.TestUtils.Simulate.click(minusBtn);
    }).delay(50).then(() => {
      expect(p.getRange()).to.deep.equal({
        contig: 'chr17',
        start: 7500700,
        stop: 7500800
      });
      expect(startTxt.value).to.equal('7500700');
      expect(stopTxt.value).to.equal('7500800');
      React.addons.TestUtils.Simulate.click(plusBtn);
    }).delay(50).then(() => {
      expect(p.getRange()).to.deep.equal({
        contig: 'chr17',
        start: 7500725,
        stop: 7500775
      });
      expect(startTxt.value).to.equal('7500725');
      expect(stopTxt.value).to.equal('7500775');
      p.destroy();
    });
  });
});

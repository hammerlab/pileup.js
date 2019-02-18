/**
 * This tests that the Controls and reference track render correctly, even when
 * an externally-set range uses a different chromosome naming system (e.g. '17'
 * vs 'chr17'). See https://github.com/hammerlab/pileup.js/issues/146
 * @flow
 */

'use strict';

import sinon from 'sinon';
import {expect} from 'chai';

import pileup from '../../main/pileup';
import dataCanvas from 'data-canvas';
import {waitFor} from '../async';

import RemoteFile from '../../main/RemoteFile';


describe('GeneTrack', function() {
  var testDiv = document.getElementById('testdiv');
  if (!testDiv) throw new Error("Failed to match: testdiv");

  var server: any = null, response;

  before((): any => {
    // server for genes
    return new RemoteFile('/test-data/refSeqGenes.chr17.75000000-75100000.json').getAllString().then(data => {
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
          return url === '/test-data/ensembl.chr17.bb';
      });
    });
  });

  after(function(): any {
      server.restore();
  });

  beforeEach(() => {
    testDiv.style.width = '800px';
    dataCanvas.RecordingContext.recordAll();
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
    // avoid pollution between tests.
    testDiv.innerHTML = '';
  });
  var {drawnObjects, callsOf} = dataCanvas.RecordingContext;

  function ready(): boolean {
    return testDiv.querySelector('canvas') != null &&
        drawnObjects(testDiv, '.genes').length > 0;
  }

  it('should render genes', function(): any {
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
          data: pileup.formats.bigBed({
            url: '/test-data/ensembl.chr17.bb'
          }),
          viz: pileup.viz.genes(),
        }
      ]
    });

    return waitFor(ready, 2000)
      .then(() => {
        var genes = drawnObjects(testDiv, '.genes');
        expect(genes).to.have.length(4);
        expect(genes.map(g => g.name)).to.deep.equal(
            [ 'STX8', 'WDR16', 'WDR16', 'USP43' ]);  // two transcripts of WDR16

        // Only one WDR16 gets drawn (they're overlapping)
        var texts = callsOf(testDiv, '.genes', 'fillText');
        expect(texts.map(t => t[1])).to.deep.equal(['STX8', 'WDR16', 'USP43']);
        p.destroy();
      });
  });

  it('should render genes from GA4GH Features', function(): any {

    server.respondWith('POST', '/v0.6.0/features/search',
                       [200, { "Content-Type": "application/json" }, response]);

    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 75000000, stop: 75100000},
      tracks: [
        {
          viz: pileup.viz.genome(),
          data: pileup.formats.twoBit({
            url: '/test-data/test.2bit'
          }),
          isReference: true
        },
        {
          data: pileup.formats.GAGene({
            endpoint: '/v0.6.0',
            featureSetId: "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIl0",
          }),
          viz: pileup.viz.genes(),
        }
      ]
    });

    return waitFor(ready, 2000)
      .then(() => {
        var genes = drawnObjects(testDiv, '.genes');
        expect(genes).to.have.length(3);
        expect(genes.map(g => g.name)).to.deep.equal(
            [ 'SNHG20', 'MIR6516', 'SCARNA16']);

        p.destroy();
      });
  });

  it('should not print null gene name', function(): any {
    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 1156459, stop: 1156529},
      tracks: [
        {
          viz: pileup.viz.genome(),
          data: pileup.formats.twoBit({
            url: '/test-data/test.2bit'
          }),
          isReference: true
        },
        {
          data: pileup.formats.bigBed({
            url: '/test-data/ensembl.chr17.bb'
          }),
          viz: pileup.viz.genes(),
        }
      ]
    });

    return waitFor(ready, 2000)
      .then(() => {
        var genes = drawnObjects(testDiv, '.genes');
        expect(genes).to.have.length(1);
        expect(genes.map(g => g.name)).to.deep.equal(
            [ 'null']);  // null gene name

        // Do not draw null gene name. Default to gene id.
        var texts = callsOf(testDiv, '.genes', 'fillText');
        expect(texts.map(t => t[1])).to.deep.equal(['ENST00000386721']);
        p.destroy();
      });
  });
});

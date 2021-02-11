/**
 * This tests that the Controls and reference track render correctly, even when
 * an externally-set range uses a different chromosome naming system (e.g. '17'
 * vs 'chr17'). See https://github.com/hammerlab/pileup.js/issues/146
 * @flow
 */

'use strict';

import {expect} from 'chai';

import sinon from 'sinon';

import pileup from '../../main/pileup';
import dataCanvas from 'data-canvas';
import {waitFor} from '../async';
import RemoteFile from '../../main/RemoteFile';
import TwoBit from '../../main/data/TwoBit';
import TwoBitDataSource from '../../main/sources/TwoBitDataSource';
import MappedRemoteFile from '../MappedRemoteFile';
import {FakeTwoBit} from '../FakeTwoBit';

describe('GenotypeTrack', function() {
  var server: any = null, response;
  var reference: string = '';
  var fakeTwoBit, referenceSource;

  var testDiv = document.getElementById('testdiv');
  if (!testDiv) throw new Error("Failed to match: testdiv");

  // Test data files
  var twoBitFile = new MappedRemoteFile(
          '/test-data/hg19.2bit.mapped',
          [[0, 16383], [691179834, 691183928], [694008946, 694011447]]);


  before(function(): any {
    var twoBit = new TwoBit(twoBitFile);
    return twoBit.getFeaturesInRange('17', 7500000, 7510000).then(seq => {
      reference = seq;
      return new RemoteFile('/test-data/variants.ga4gh.chr1.10000-11000.json').getAllString();
    }).then(data => {
      response = data;

      server = sinon.createFakeServer();
      server.autoRespond = true;

      // Sinon should ignore 2bit request. RemoteFile handles this request.
      sinon.fakeServer.xhr.useFilters = true;
      sinon.fakeServer.xhr.addFilter(function (method, url) {
          return url === '/test-data/test.2bit';
      });
      // Sinon should ignore vcf file requests. RemoteFile handles this request.
      sinon.fakeServer.xhr.addFilter(function (method, url) {
          return url === '/test-data/test.vcf';
      });

      fakeTwoBit = new FakeTwoBit(twoBitFile),
          referenceSource = TwoBitDataSource.createFromTwoBitFile(fakeTwoBit);

      // Release the reference first.
      fakeTwoBit.release(reference);

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

  var drawnObjects = dataCanvas.RecordingContext.drawnObjects;

  function ready() {
    return testDiv.getElementsByTagName('canvas').length > 0 &&
        drawnObjects(testDiv, '.genotypeRows').length > 1;
  }

  it('should render genotypes from vcf file', function(): any {

    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 9386380, stop: 9386390},
      tracks: [
        {
          viz: pileup.viz.genome(),
          data: referenceSource,
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

  it('should render genotypes from GA4GH Variants', function(): any {


    server.respondWith('POST', '/v0.6.0/variants/search',
                           [200, { "Content-Type": "application/json" }, response]);


    var callSetId = "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIiwiSEcwMDA5NiJd";
    var callSetName = "HG00096";

    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 9386380, stop: 9386390},
      tracks: [
        {
          viz: pileup.viz.genome(),
          data: referenceSource,
          isReference: true
        },
        {
          data: pileup.formats.GAVariant({
            endpoint: '/v0.6.0',
            variantSetId: "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIl0",
            callSetIds: [callSetId],
            callSetNames: [callSetName]
          }),
          viz: pileup.viz.genotypes(),
        }
      ]
    });

    return waitFor(ready, 2000)
      .then(() => {
        var labels = drawnObjects(testDiv, '.genotypeLabels');

        expect(labels).to.have.length(1);
        expect(labels).to.deep.equal(
            [callSetName]);

        var genotypes = drawnObjects(testDiv, '.genotypeRows');

        expect(genotypes).to.have.length(2);
        expect(genotypes[0]).to.deep.equal(callSetName);
        expect(genotypes[1].position).to.deep.equal(9386385);

        p.destroy();
      });

  });

  it('should render genotypes from GA4GH Variants when call names are not specified', function(): any {


    server.respondWith('POST', '/v0.6.0/variants/search',
                           [200, { "Content-Type": "application/json" }, response]);


    var callSetId = "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIiwiSEcwMDA5NiJd";

    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 9386380, stop: 9386390},
      tracks: [
        {
          viz: pileup.viz.genome(),
          data: referenceSource,
          isReference: true
        },
        {
          data: pileup.formats.GAVariant({
            endpoint: '/v0.6.0',
            variantSetId: "WyIxa2dlbm9tZXMiLCJ2cyIsInBoYXNlMy1yZWxlYXNlIl0",
            callSetIds: [callSetId]
          }),
          viz: pileup.viz.genotypes(),
        }
      ]
    });


    return waitFor(ready, 2000)
      .then(() => {
        var labels = drawnObjects(testDiv, '.genotypeLabels');

        expect(labels).to.have.length(1);
        expect(labels).to.deep.equal(
            [callSetId]);

        var genotypes = drawnObjects(testDiv, '.genotypeRows');

        expect(genotypes).to.have.length(2);
        expect(genotypes[0]).to.deep.equal(callSetId);
        expect(genotypes[1].position).to.deep.equal(9386385);

        p.destroy();
      });

  });

  it('should render genotypes from GA4GH Variant JSON', function(): any {

    var p = pileup.create(testDiv, {
      range: {contig: '17', start: 9386380, stop: 9386390},
      tracks: [
        {
          viz: pileup.viz.genome(),
          data: referenceSource,
          isReference: true
        },
        {
          data: pileup.formats.variantJson(response),
          viz: pileup.viz.genotypes(),
        }
      ]
    });

    var callSetName = "HG00096";

    return waitFor(ready, 2000)
      .then(() => {
        var labels = drawnObjects(testDiv, '.genotypeLabels');

        expect(labels).to.have.length(1);
        expect(labels).to.deep.equal(
            [callSetName]);

        var genotypes = drawnObjects(testDiv, '.genotypeRows');

        expect(genotypes).to.have.length(2);
        expect(genotypes[0]).to.deep.equal(callSetName);
        expect(genotypes[1].position).to.deep.equal(9386385);

        p.destroy();
      });
  });

});

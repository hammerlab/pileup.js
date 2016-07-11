/* @flow */
'use strict';

import {expect} from 'chai';

import Q from 'q';

import BigBed from '../../main/data/BigBed';
import ContigInterval from '../../main/ContigInterval';

describe('BigBed', function() {
  function getTestBigBed() {
    return new BigBed('/test-data/itemRgb.bb');   // See test-data/README.md
  }

  function getUncompressedTestBigBed() {
    return new BigBed('/test-data/simple17unc.bb');   // See test-data/README.md
  }

  it('should extract features in a range', function() {
    var bb = getTestBigBed();

    return bb.getFeaturesInRange('chrX', 151077036, 151078532)
        .then(features => {
          // Here's what these two lines in the file look like:
          // chrX 151077031 151078198 MID_BLUE 0 - 151077031 151078198 0,0,128
          // chrX 151078198 151079365 VIOLET_RED1 0 - 151078198 151079365 255,62,150
          expect(features).to.have.length(2);
          expect(features[0].contig).to.equal('chrX');
          expect(features[0].start).to.equal(151077031);
          expect(features[0].stop).to.equal(151078198);
          expect(features[1].contig).to.equal('chrX');
          expect(features[1].start).to.equal(151078198);
          expect(features[1].stop).to.equal(151079365);

          var rest0 = features[0].rest.split('\t');
          expect(rest0).to.have.length(6);
          expect(rest0[0]).to.equal('MID_BLUE');
          expect(rest0[2]).to.equal('-');
          expect(rest0[5]).to.equal('0,0,128');

          var rest1 = features[1].rest.split('\t');
          expect(rest1).to.have.length(6);
          expect(rest1[0]).to.equal('VIOLET_RED1');
          expect(rest1[2]).to.equal('-');
          expect(rest1[5]).to.equal('255,62,150');
        });
  });

  it('should extract features from an uncompressed BigBed', function () {
    var bb = getUncompressedTestBigBed();

    return bb.getFeaturesInRange('chr17', 60000, 270000)
      .then(features => {
        // Here's what these three lines in the file look like:
        // chr17	62296	202576
        // chr17	62296	202576
        // chr17	260433	264713
        expect(features).to.deep.equal(
          [
            { contig: 'chr17', start: 62296, stop: 202576, rest: "" },
            { contig: 'chr17', start: 62296, stop: 202576, rest: "" },
            { contig: 'chr17', start: 260433, stop: 264713, rest: "" }
          ]
        );
      });
  });

  it('should have inclusive ranges', function() {
    // The matches looks like this:
    // chrX 151071196 151072363 RED
    // chrX 151094536 151095703 PeachPuff
    var red = [151071196, 151072362];  // note: stop is inclusive

    var bb = getTestBigBed();
    var expectN = n => features => {
        expect(features).to.have.length(n);
      };

    return Q.all([
        // request for precisely one row from the file.
        bb.getFeaturesInRange('chrX', red[0], red[1])
            .then(expectN(1)),
        // the additional base in the range hits another row.
        bb.getFeaturesInRange('chrX', red[0], 1 + red[1])
            .then(expectN(2)),
        // this overlaps exactly one base pair of the first feature.
        bb.getFeaturesInRange('chrX', red[0] - 1000, red[0])
            .then(expectN(1)),
        // but this range ends one base pair before it.
        bb.getFeaturesInRange('chrX', red[0] - 1000, red[0] - 1)
            .then(expectN(0))
    ]);
  });

  it('should add "chr" to contig names', function() {
    var bb = getTestBigBed();

    return bb.getFeaturesInRange('X', 151077036, 151078532)
        .then(features => {
          // (same as 'should extract features in a range' test)
          expect(features).to.have.length(2);
          expect(features[0].contig).to.equal('chrX');
          expect(features[1].contig).to.equal('chrX');
        });
  });

  it('should cache requests in a block', function() {
    var bb = getTestBigBed(),
        remote = bb.remoteFile;
    return bb.getFeaturesInRange('X', 151077036, 151078532).then(() => {
      // cache has been warmed up -- flush it to get a deterministic test.
      remote.clearCache();
      remote.numNetworkRequests = 0;

      // This should generate one new request.
      return bb.getFeaturesInRange('X', 151077036, 151078532);
    }).then(features => {
      expect(features).to.have.length(2);
      expect(remote.numNetworkRequests).to.equal(1);
      return bb.getFeaturesInRange('X', 151071196, 151072362);
    }).then(features => {
      // Another request in the same block should not generate a new request.
      expect(features).to.have.length(1);
      expect(remote.numNetworkRequests).to.equal(1);
      return bb.getFeaturesInRange('Y', 50, 51);
    }).then(features => {
      // But a request from another block (the 'Y' block) should.
      expect(features).to.have.length(1);
      expect(remote.numNetworkRequests).to.equal(2);
    });
  });

  it('should fetch full blocks', function() {
    var bb = getTestBigBed();

    var range = new ContigInterval('X', 151077036, 151078532);
    return bb.getFeatureBlocksOverlapping(range)
        .then(blockFeatures => {
          expect(blockFeatures).to.have.length(1);  // just one block fetched.
          var range = blockFeatures[0].range,
              rows = blockFeatures[0].rows;
          expect(rows).to.have.length(21);  // all the chrX features.
          expect(range.toString()).to.equal('chrX:151071196-151095703');
        });
  });

  // Things left to test:
  // - getFeatures which crosses a block boundary
  // - uncompressed bigBed file.
});

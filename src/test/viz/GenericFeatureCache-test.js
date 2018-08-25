/**
 * @flow
 */
'use strict';

import {expect} from 'chai';
import _ from 'underscore';

import {GenericFeatureCache} from '../../main/viz/GenericFeatureCache';
import ContigInterval from '../../main/ContigInterval';
import {fakeSource} from '../FakeAlignment';


describe('GenericFeatureCache', function() {
  function ci(chr: string, start: number, end:number) {
    return new ContigInterval(chr, start, end);
  }

  function makeCache(features: any) {
    var cache = new GenericFeatureCache(fakeSource);
    _.flatten(features).forEach(feature => cache.addFeature(feature));
    return cache;
  }

  it('should put non-overlapping features in the same row', function(done) {
    var a = {id: "A",
            featureType: "Feature",
          position: new ContigInterval('chr1', 100, 200),
          score: 1000};

    var b = {id: "B",
        featureType: "Feature",
      position: new ContigInterval('chr1', 300, 400),
      score: 1000};

    var c = {id: "C",
        featureType: "Feature",
      position: new ContigInterval('chr1', 700, 800),
      score: 1000};

    var cache = makeCache([a,b,c]);

    var groups = _.values(cache.groups);
    expect(groups).to.have.length(3);
    expect(groups[0].row).to.equal(0);
    expect(groups[1].row).to.equal(0);
    expect(groups[2].row).to.equal(0);
    expect(cache.pileupHeightForRef('chr1')).to.equal(1);
    done();
  });


  it('should put overlapping features in the different row', function(done) {
    var a = {id: "A",
            featureType: "Feature",
          position: new ContigInterval('chr1', 100, 200),
          score: 1000};

    var b = {id: "B",
        featureType: "Feature",
      position: new ContigInterval('chr1', 100, 200),
      score: 1000};

    var c = {id: "C",
        featureType: "Feature",
      position: new ContigInterval('chr1', 150, 300),
      score: 1000};

    var cache = makeCache([a,b,c]);

    var groups = _.values(cache.groups);
    expect(groups).to.have.length(3);
    expect(groups[0].row).to.equal(0);
    expect(groups[1].row).to.equal(1);
    expect(groups[2].row).to.equal(2);
    expect(cache.pileupHeightForRef('chr1')).to.equal(3);
    done();
  });

  it('should find overlapping features', function(done) {
    var a = {id: "A",
            featureType: "Feature",
          position: new ContigInterval('chr1', 100, 200),
          score: 1000};

    var b = {id: "B",
        featureType: "Feature",
      position: new ContigInterval('chr1', 300, 400),
      score: 1000};

    var c = {id: "C",
        featureType: "Feature",
      position: new ContigInterval('chr1', 700, 800),
      score: 1000};

    var cache = makeCache([a,b,c]);

    expect(cache.getGroupsOverlapping(ci('chr1', 100, 200))).to.have.length(1);
    expect(cache.getGroupsOverlapping(ci('chr1', 150, 500))).to.have.length(2);
    expect(cache.getGroupsOverlapping(ci('chr1', 100, 800))).to.have.length(3);

    // 'chr'-tolerance
    expect(cache.getGroupsOverlapping(ci('chr1', 100, 200))).to.have.length(1);
    done();
  });

});

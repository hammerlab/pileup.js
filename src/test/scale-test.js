/** @flow */
'use strict';

import {expect} from 'chai';

import scale from '../main/scale';

describe('scale', function() {
  it('should define a linear scale', function() {
    var sc = scale.linear().domain([100, 201]).range([0, 1000]);
    expect(sc(100)).to.equal(0);
    expect(sc(201)).to.equal(1000);
  });

  it('should be invertible', function() {
    var sc = scale.linear().domain([100, 201]).range([0, 1000]);
    expect(sc.invert(0)).to.equal(100);
    expect(sc.invert(1000)).to.equal(201);
  });

  it('should be clampable', function() {
    var sc = scale.linear().domain([100, 201]).range([0, 1000]);
    sc = sc.clamp(true);
    expect(sc(0)).to.equal(0);
    expect(sc(100)).to.equal(0);
    expect(sc(201)).to.equal(1000);
    expect(sc(500)).to.equal(1000);
  });

  it('should have nice values', function() {
    var sc = scale.linear().domain([33, 0]).range(0, 100).nice();
    expect(sc.domain()).to.deep.equal([35, 0]);

    sc = scale.linear().domain([0, 33]).range(0, 100).nice();
    expect(sc.domain()).to.deep.equal([0, 35]);
  });
});

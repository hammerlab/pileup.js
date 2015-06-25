/* @flow */
'use strict';

var expect = require('chai').expect;

var Interval = require('../src/Interval');

describe('Interval', function() {
  it('should have start/stop/length', function() {
    var x = new Interval(10, 20);
    expect(x.start).to.equal(10);
    expect(x.stop).to.equal(20);
    expect(x.length()).to.equal(11);
    expect(x.toString()).to.equal('[10, 20]');
  });

  it('should determine containment', function() {
    var x = new Interval(-10, 10);
    expect(x.contains(0)).to.be.true;
    expect(x.contains(-10)).to.be.true;
    expect(x.contains(+10)).to.be.true;
    expect(x.contains(+11)).to.be.false;
    expect(x.contains(-11)).to.be.false;
  });

  it('should work with empty intervals', function() {
    var empty = new Interval(5, 0),
        other = new Interval(-10, 10);
    expect(empty.contains(0)).to.be.false;
    expect(empty.length()).to.equal(0);
    expect(empty.intersect(other).length()).to.equal(0);
  });

  it('should determine intersections', function() {
    var tp53 = new Interval(7512444, 7531643);
    var other = new Interval(7512444, 7531642);

    expect(tp53.intersects(other)).to.be.true;
  });

  it('should clone', function() {
    var x = new Interval(0, 5),
        y = x.clone();

    y.start = 1;
    expect(x.start).to.equal(0);
    expect(y.start).to.equal(1);
  });

  it('should intersect many intervals', function() {
    var ivs = [
        new Interval(0, 10),
        new Interval(5, 15),
        new Interval(-5, 5)
    ];

    var intAll = Interval.intersectAll;
    expect(intAll( ivs            ).toString()).to.equal('[5, 5]');
    expect(intAll([ivs[0], ivs[1]]).toString()).to.equal('[5, 10]');
    expect(intAll([ivs[0], ivs[2]]).toString()).to.equal('[0, 5]');
    expect(intAll([ivs[0]        ]).toString()).to.equal('[0, 10]');

    expect(() => intAll([])).to.throw(/intersect zero intervals/);
  });

  it('should construct bounding intervals', function() {
    var ivs = [
        new Interval(0, 10),
        new Interval(5, 15),
        new Interval(-5, 5)
    ];

    var bound = Interval.boundingInterval;
    expect(bound( ivs            ).toString()).to.equal('[-5, 15]');
    expect(bound([ivs[0], ivs[1]]).toString()).to.equal('[0, 15]');
    expect(bound([ivs[0], ivs[2]]).toString()).to.equal('[-5, 10]');
    expect(bound([ivs[0]        ]).toString()).to.equal('[0, 10]');

    expect(() => bound([])).to.throw(/bound zero intervals/);
  });

  it('should determine coverage', function() {
    var iv = new Interval(10, 20);
    expect(iv.isCoveredBy([
      new Interval(0, 10),
      new Interval(5, 15),
      new Interval(10, 20)
    ])).to.be.true;

    expect(iv.isCoveredBy([
      new Interval(0, 10),
      new Interval(5, 15),
      new Interval(16, 30)
    ])).to.be.true;

    expect(iv.isCoveredBy([
      new Interval(0, 10),
      new Interval(5, 15),
      new Interval(17, 30)  // a gap!
    ])).to.be.false;

    expect(iv.isCoveredBy([
      new Interval(0, 30)
    ])).to.be.true;

    expect(iv.isCoveredBy([
      new Interval(15, 30)
    ])).to.be.false;

    expect(iv.isCoveredBy([
      new Interval(0, 15)
    ])).to.be.false;

    expect(() => iv.isCoveredBy([
      new Interval(5, 15),
      new Interval(0, 10)
    ])).to.throw(/sorted ranges/);
  });
});

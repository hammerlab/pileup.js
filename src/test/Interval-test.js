/* @flow */
'use strict';

import {expect} from 'chai';

import Interval from '../main/Interval';

describe('Interval', function() {
  it('should have start/stop/length', function() {
    var x = new Interval(10, 20);
    expect(x.start).to.equal(10);
    expect(x.stop).to.equal(20);
    expect(x.length()).to.equal(11);
    expect(x.toString()).to.equal('[10, 21)');
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
    expect(intAll( ivs            ).toString()).to.equal('[5, 6)');
    expect(intAll([ivs[0], ivs[1]]).toString()).to.equal('[5, 11)');
    expect(intAll([ivs[0], ivs[2]]).toString()).to.equal('[0, 6)');
    expect(intAll([ivs[0]        ]).toString()).to.equal('[0, 11)');

    expect(() => intAll([])).to.throw(/intersect zero intervals/);
  });

  it('should construct bounding intervals', function() {
    var ivs = [
        new Interval(0, 10),
        new Interval(5, 15),
        new Interval(-5, 5)
    ];

    var bound = Interval.boundingInterval;
    expect(bound( ivs            ).toString()).to.equal('[-5, 16)');
    expect(bound([ivs[0], ivs[1]]).toString()).to.equal('[0, 16)');
    expect(bound([ivs[0], ivs[2]]).toString()).to.equal('[-5, 11)');
    expect(bound([ivs[0]        ]).toString()).to.equal('[0, 11)');

    expect(() => bound([])).to.throw(/bound zero intervals/);
  });

  it('should partition small interval', function() {
    expect(Interval.partition(new Interval(15, 17), 10)).to.deep.equal(
      [
        new Interval(15, 15),
        new Interval(16, 16),
        new Interval(17, 17)
      ]
    );

    expect(Interval.partition(new Interval(15, 17), 3)).to.deep.equal(
      [
        new Interval(15, 17)
      ]
    );

    expect(Interval.partition(new Interval(15, 17), 2)).to.deep.equal(
      [
        new Interval(15, 15),
        new Interval(16, 17)
      ]
    );

    expect(Interval.partition(new Interval(15, 17), 1)).to.deep.equal(
      [
        new Interval(15, 15),
        new Interval(16, 16),
        new Interval(17, 17)
      ]
    );
  });

  it('should partition mixed intervals', function() {
    expect(Interval.partition(new Interval(15, 32), 2)).to.deep.equal(
      [
        new Interval(15, 15),
        new Interval(16, 31),
        new Interval(32, 32)
      ]
    );

    expect(Interval.partition(new Interval(1, 62), 2)).to.deep.equal(
      [
        new Interval(1, 1),
        new Interval(2, 3),
        new Interval(4, 7),
        new Interval(8, 15),
        new Interval(16, 31),
        new Interval(32, 47),
        new Interval(48, 55),
        new Interval(56, 59),
        new Interval(60, 61),
        new Interval(62, 62)
      ]
    );
  });

  it('should return single partitions', function() {
    expect(Interval.partition(new Interval(0, 63), 2)).to.deep.equal(
      [
        new Interval(0, 63)
      ]
    );

    expect(Interval.partition(new Interval(0, 63), 4)).to.deep.equal(
      [
        new Interval(0, 63)
      ]
    );

    expect(Interval.partition(new Interval(0, 63), 8)).to.deep.equal(
      [
        new Interval(0, 63)
      ]
    );
  });

  it('should partition multiple intervals', function() {
    expect(Interval.partition(new Interval(0, 63), 16)).to.deep.equal(
      [
        new Interval(0, 15),
        new Interval(16, 31),
        new Interval(32, 47),
        new Interval(48, 63)
      ]
    );
  });

  it('should partition singleton interval', function() {
    expect(Interval.partition(new Interval(10, 10), 8)).to.deep.equal(
      [
        new Interval(10, 10)
      ]
    );

    expect(Interval.partition(new Interval(10, 10), 1)).to.deep.equal(
      [
        new Interval(10, 10)
      ]
    );
  });

  it('should partition empty interval', function() {
    expect(Interval.partition(new Interval(10, 9), 8)).to.deep.equal(
      []
    );

    expect(Interval.partition(new Interval(10, 9), 1)).to.deep.equal(
      []
    );
  });

  it('should handle mixed partition bases', function() {
    expect(Interval.partition(new Interval(9, 121), [1, 5, 10, 25])).to.deep.equal(
      [
        new Interval(9, 9),
        new Interval(10, 19),
        new Interval(20, 24),
        new Interval(25, 49),
        new Interval(50, 74),
        new Interval(75, 99),
        new Interval(100, 109),
        new Interval(110, 119),
        new Interval(120, 120),
        new Interval(121, 121)
      ]
    );
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

  it('should subtract intervals', function() {
    //   0123456789
    // a ----------
    // b ---
    // c        ---
    // d    -----
    var a = new Interval(0, 9),
        b = new Interval(0, 2),
        c = new Interval(7, 9),
        d = new Interval(3, 7);
    expect(a.subtract(a).map(x => x.toString())).to.deep.equal([]);
    expect(a.subtract(b).map(x => x.toString())).to.deep.equal(['[3, 10)']);
    expect(a.subtract(c).map(x => x.toString())).to.deep.equal(['[0, 7)']);
    expect(a.subtract(d).map(x => x.toString())).to.deep.equal(['[0, 3)','[8, 10)']);

    expect(b.subtract(a).map(x => x.toString())).to.deep.equal([]);
    expect(b.subtract(b).map(x => x.toString())).to.deep.equal([]);
    expect(b.subtract(c).map(x => x.toString())).to.deep.equal([b.toString()]);
    expect(b.subtract(d).map(x => x.toString())).to.deep.equal([b.toString()]);

    expect(c.subtract(a).map(x => x.toString())).to.deep.equal([]);
    expect(c.subtract(b).map(x => x.toString())).to.deep.equal([c.toString()]);
    expect(c.subtract(c).map(x => x.toString())).to.deep.equal([]);
    expect(c.subtract(d).map(x => x.toString())).to.deep.equal(['[8, 10)']);

    expect(d.subtract(a).map(x => x.toString())).to.deep.equal([]);
    expect(d.subtract(b).map(x => x.toString())).to.deep.equal([d.toString()]);
    expect(d.subtract(c).map(x => x.toString())).to.deep.equal(['[3, 7)']);
    expect(d.subtract(d).map(x => x.toString())).to.deep.equal([]);
  });

  it('should compute complements', function() {
    var iv = new Interval(0, 99);
    var exons = [
        new Interval(10, 19),
        new Interval(30, 39),
        new Interval(35, 49),
        new Interval(80, 99)
    ];

    expect(iv.complementIntervals(exons).map(x => x.toString())).to.deep.equal([
      '[0, 10)',
      '[20, 30)',
      '[50, 80)'
    ]);
  });
});

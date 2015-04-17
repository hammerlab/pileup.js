/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;

var ContigInterval = require('../src/ContigInterval');

describe('ContigInterval', function() {
  it('should have basic accessors', function() {
    var tp53 = new ContigInterval(10, 7512444, 7531643);
    expect(tp53.toString()).to.equal('10:7512444-7531643');
    expect(tp53.contig).to.equal(10);
    expect(tp53.start()).to.equal(7512444);
    expect(tp53.stop()).to.equal(7531643);
    expect(tp53.length()).to.equal(19200);
  });

  it('should determine intersections', function() {
    var tp53 = new ContigInterval(10, 7512444, 7531643);
    var other = new ContigInterval(10, 7512444, 7531642);

    expect(tp53.intersects(other)).to.be.true;
  });

  it('should coalesce lists of intervals', function() {
    var ci = (a, b, c) => new ContigInterval(a, b, c);

    var coalesceToString =
        ranges => ContigInterval.coalesce(ranges).map(r => r.toString());

    expect(coalesceToString([
      ci(0, 0, 10),
      ci(0, 10, 20),
      ci(0, 20, 30)
    ])).to.deep.equal([ '0:0-30' ]);

    expect(coalesceToString([
      ci(0, 0, 10),
      ci(0, 5, 20),
      ci(0, 20, 30)
    ])).to.deep.equal([ '0:0-30' ]);

    expect(coalesceToString([
      ci(0, 0, 10),
      ci(0, 5, 19),
      ci(0, 20, 30)  // ContigInterval are inclusive, so these are adjacent
    ])).to.deep.equal([
      '0:0-30'
    ]);

    expect(coalesceToString([
      ci(0, 20, 30),  // unordered
      ci(0, 5, 19),
      ci(0, 0, 10)
    ])).to.deep.equal([
      '0:0-30'
    ]);

    expect(coalesceToString([
      ci(0, 20, 30),
      ci(0, 5, 18),
      ci(0, 0, 10)
    ])).to.deep.equal([
      '0:0-18', '0:20-30'
    ]);
  });
});

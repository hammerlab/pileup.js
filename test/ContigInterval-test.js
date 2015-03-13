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
});

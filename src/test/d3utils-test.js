/* @flow */
'use strict';

var expect = require('chai').expect;
var d3utils = require('../main/d3utils');

describe('d3utils', function() {
  describe('formatRange', function() {
    var formatRange = d3utils.formatRange;

    it('should format view sizes correctly', function() {
      var r = formatRange(101);
      expect(r.prefix).to.be.equal("101");
      expect(r.unit).to.be.equal("bp");

      r = formatRange(10001);
      expect(r.prefix).to.be.equal("10,001");
      expect(r.unit).to.be.equal("bp");

      r = formatRange(10001001);
      expect(r.prefix).to.be.equal("10,001");
      expect(r.unit).to.be.equal("kbp");

      r = formatRange(10001000001);
      expect(r.prefix).to.be.equal("10,001");
      expect(r.unit).to.be.equal("Mbp");
    });
  });
});

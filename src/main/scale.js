/**
 * Lightweight replacement for d3.scale.linear().
 * This only supports numeric scales, e.g. scale.range(['red', 'blue']) is invalid.
 * @flow
 */
'use strict';

function linear(): any {
  var clamped = false,
      domain = [0, 1],
      range = [0, 1];

  var me = function(x) {
    if (clamped) {
      x = Math.max(Math.min(x, domain[1]), domain[0]);
    }
    // TODO: compute coefficients once.
    return (x - domain[0]) / (domain[1] - domain[0]) * (range[1] - range[0]) + range[0];
  };

  me.clamp = function(x) {
    if (x === undefined) return clamped;
    clamped = x;
    return this;
  };
  me.domain = function(x) {
    if (x === undefined) return domain;
    domain = x;
    return this;
  };
  me.range = function(x) {
    if (x === undefined) return range;
    range = x;
    return this;
  };
  me.invert = function(x) {
    if (clamped) {
      throw `Can't invert a clamped linear scale.`;
    }
    return (x - range[0]) / (range[1] - range[0]) * (domain[1] - domain[0]) + domain[0];
  };
  me.nice = function() {
    // This method is adapted directly from d3's linear scale nice method.
    // See https://github.com/mbostock/d3/blob/5b981a18d/src/scale/linear.js#L94-L112
    var m = 10;
    var extent = domain,
        span = Math.abs(extent[1] - extent[0]),
        step = Math.pow(10, Math.floor(Math.log(span / m) / Math.LN10)),
        err = m / span * step;

    // Filter ticks to get closer to the desired count.
    if (err <= 0.15) step *= 10;
    else if (err <= 0.35) step *= 5;
    else if (err <= 0.75) step *= 2;

    var nice = {
      floor: function(x) { return Math.floor(x / step) * step; },
      ceil: function(x) { return Math.ceil(x / step) * step; }
    };

    var i0 = 0,
        i1 = 1,
        x0 = domain[i0],
        x1 = domain[i1],
        dx;

    if (x1 < x0) {
      dx = i0; i0 = i1; i1 = dx;
      dx = x0; x0 = x1; x1 = dx;
    }

    domain[i0] = nice.floor(x0);
    domain[i1] = nice.ceil(x1);
    return this;
  };

  return me;
}

module.exports = { linear };

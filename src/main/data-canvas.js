/**
 * Wrappers around CanvasRenderingContext2D to facilitate testing and click-tracking.
 *
 * This adds the concept of a "data stack" to the canvas. When shapes are
 * drawn, they represent the objects currently on the stack. This stack can be
 * manipulated using context.pushObject() and context.popObject().
 *
 * See test file for sample usage.
 *
 * Note: this file does some unusual things with Objects which are hard to
 * represent within Flow's type system. Hence type checking is disabled for it.
 */

// Turn obj into a proxy for target. This forwards both function calls and
// property setters/getters.
function forward(obj: Object, target: Object, onlyAccessors: ?boolean) {
  onlyAccessors = onlyAccessors || false;
  for (var k in target) {
    (function(k) {
      if (typeof(target[k]) == 'function') {
        if (!onlyAccessors) {
          obj[k] =  target[k].bind(target);
        }
      } else {
        Object.defineProperty(obj, k, {
          get: function() { return target[k]; },
          set: function(x) { target[k] = x; }
        });
      }
    })(k);
  }
}

// The most basic data-aware canvas. This throws away all data information.
// Use this for basic drawing
function DataContext(ctx: CanvasRenderingContext2D) {
  forward(this, ctx);
  this.pushObject = this.popObject = function() {};
}

// This is exposed as a method for easier testing.
function getDataContext(ctx: CanvasRenderingContext2D) {
  return new DataContext(ctx);
}


/**
 * A context which records what it does (for testing).
 *
 * This proxies all calls to the underlying canvas, so they do produce visible
 * drawing. Use `drawnObjectsWith` or `calls` to test what was drawn.
 */
function RecordingContext(ctx: CanvasRenderingContext2D) {
  forward(this, ctx, true /* only foward accessors */);

  var calls = [];
  this.calls = calls;

  for (var k in ctx) {
    (k => {
      if (typeof(ctx[k]) != 'function') return;
      this[k] = function() {
        // TODO: record current drawing style
        var args = Array.prototype.slice.call(arguments);
        calls.push([k].concat(args));
        ctx[k].apply(ctx, arguments);
      };
    })(k);
  }

  this.pushObject = function(o) {
    calls.push(['pushObject', o]);
  };
  
  this.popObject = function() {
    calls.push(['popObject']);
  };
}

RecordingContext.prototype.drawnObjectsWith = function(predicate: (o: Object)=>boolean): Object[] {
  var matches = [];
  this.calls.forEach(x => {
    if (x[0] == 'pushObject' && predicate(x[1])) {
      matches.push(x[1]);
    }
  });
  return matches;
};

/**
 * A context which determines the data at a particular location.
 *
 * When drawing methods are called on this class, nothing is rendered. Instead,
 * each shape is checked to see if it includes the point of interest. If it
 * does, the current data stack is saved as a "hit".
 *
 * The `hits` property records all such hits.
 * The `hit` property records only the last (top) hit.
 */
function ClickTrackingContext(ctx: CanvasRenderingContext2D, px: number, py: number) {
  forward(this, ctx);

  var stack = [];
  this.hits = [];
  this.hit = null;
  
  var that = this;
  function recordHit() {
    that.hits.unshift(Array.prototype.slice.call(stack));
    that.hit = that.hits[0];
  }

  this.pushObject = function(o) {
    stack.unshift(o);
  };
  
  this.popObject = function() {
    stack.shift();
  };

  // These are (most of) the canvas methods which draw something.
  this.clearRect = function(x: number, y: number, w: number, h: number) { };

  this.fillRect = function(x: number, y: number, w: number, h: number) {
    if (px >= x && px <= x + w && py >= y && py <= y + h) recordHit();
  };

  this.strokeRect = function(x: number, y: number, w: number, h: number) {
    // ...
  };

  this.fill = function(fillRule?: CanvasFillRule) {
    // TODO: implement fillRule
    if (ctx.isPointInPath(px, py)) recordHit();
  };

  this.stroke = function() {
    if (ctx.isPointInStroke(px, py)) recordHit();
  };

  this.fillText = function(text: string, x: number, y: number, maxWidth?: number) {
    // ...
  };

  this.strokeText = function(text: string, x: number, y: number, maxWidth?: number) {
    // ...
  };
}

module.exports = {
  DataContext,
  RecordingContext,
  ClickTrackingContext,
  getDataContext
};

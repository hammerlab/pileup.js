'use strict';
/*global localStorage, window, Split: true */
/*jslint indent: 2 */

// Adapted from https://nathancahill.github.io/Split.js/

(function () {

  var
    Split,
    addEventListener = 'addEventListener',
    removeEventListener = 'removeEventListener',
    getBoundingClientRect = 'getBoundingClientRect',
    isIE8 = window.attachEvent && !window[addEventListener],
    document = window.document,

    calc = (
      function () {
        var
          i, el,
          prefixes = ["", "-webkit-", "-moz-", "-o-"];

        for (i = 0; i < prefixes.length; i += 1) {
          el = document.createElement('div');
          el.style.cssText = "width:" + prefixes[i] + "calc(9px)";

          if (el.style.length) {
            return prefixes[i] + "calc";
          }
        }
      }()
    );

  function elementOrSelector(el) {
    if (typeof el === 'string' || el instanceof String) {
      return document.querySelector(el);
    }

    return el;
  }

  Split = function (ids, options) {
    var
      i,
      percent,
      minSizes,
      dimension,
      clientDimension,
      clientAxis,
      position,
      gutterClass,
      paddingA,
      paddingB,
      pairs = [],
      parent = elementOrSelector(ids[0]).parentNode;

    function calculateSizes() {
      // Calculate the pairs size, and percentage of the parent size
      var
        computedStyle = window.getComputedStyle(this.parent),
        parentSize = this.parent[clientDimension] - parseFloat(computedStyle[paddingA]) - parseFloat(computedStyle[paddingB]);

      // this.size is the size of the entire frame
      this.size = this.a[getBoundingClientRect]()[dimension] + this.b[getBoundingClientRect]()[dimension] + this.aGutterSize + this.bGutterSize;
      this.percentage = Math.min(this.size / parentSize * 100, 100);
      this.start = this.a[getBoundingClientRect]()[position];
    }

    function adjust(offset) {
      // A size is the same as offset. B size is total size - A size.
      // Both sizes are calculated from the initial parent percentage.

      this.a.style[dimension] = calc + '(' + (offset / this.size * this.percentage) + '% - ' + this.aGutterSize + 'px)';
      var bsize =  this.percentage - (offset / this.size * this.percentage);
      this.b.style[dimension] = calc + '(' + bsize + '% - ' + this.bGutterSize + 'px)';
      localStorage.setItem('popup_size', bsize);
    }

    function drag(e) {
      var offset;

      if (!this.dragging) {
        return;
      }

      // Get the relative position of the event from the first side of the
      // pair.

      if (e.hasOwnProperty('touches')) {
        offset = e.touches[0][clientAxis] - this.start;
      } else {
        offset = e[clientAxis] - this.start;
      }

      // If within snapOffset of min or max, set offset to min or max

      if (offset <=  this.aMin + options.snapOffset) {
        offset = this.aMin;
      } else if (offset >= this.size - this.bMin - options.snapOffset) {
        offset = this.size - this.bMin;
      }

      adjust.call(this, offset);

      if (options.onDrag) {
        options.onDrag();
      }
    }

    function preventSelection() {
      return false;
    }

    // Event listeners for drag events, bound to a pair object.
    // Calculate the pair's position and size when dragging starts.
    // Prevent selection on start and re-enable it when done.
    function stopDragging() {
      var
        self = this,
        a = self.a,
        b = self.b;

      if (self.dragging && options.onDragEnd) {
        options.onDragEnd();
      }

      self.dragging = false;

      window[removeEventListener]('mouseup', self.stop);
      window[removeEventListener]('touchend', self.stop);
      window[removeEventListener]('touchcancel', self.stop);

      self.parent[removeEventListener]('mousemove', self.move);
      self.parent[removeEventListener]('touchmove', self.move);

      delete self.stop;
      delete self.move;

      a[removeEventListener]('selectstart', preventSelection);
      a[removeEventListener]('dragstart', preventSelection);
      b[removeEventListener]('selectstart', preventSelection);
      b[removeEventListener]('dragstart', preventSelection);

      a.style.userSelect = '';
      a.style.webkitUserSelect = '';
      a.style.MozUserSelect = '';
      a.style.pointerEvents = '';

      b.style.userSelect = '';
      b.style.webkitUserSelect = '';
      b.style.MozUserSelect = '';
      b.style.pointerEvents = '';

      self.gutter.style.cursor = '';
      self.parent.style.cursor = '';
    }

    function startDragging(e) {
      var
        self = this,
        a = self.a,
        b = self.b;

      if (!self.dragging && options.onDragStart) {
        options.onDragStart();
      }

      e.preventDefault();

      self.dragging = true;
      self.move = drag.bind(self);
      self.stop = stopDragging.bind(self);

      window[addEventListener]('mouseup', self.stop);
      window[addEventListener]('touchend', self.stop);
      window[addEventListener]('touchcancel', self.stop);

      self.parent[addEventListener]('mousemove', self.move);
      self.parent[addEventListener]('touchmove', self.move);

      a[addEventListener]('selectstart', preventSelection);
      a[addEventListener]('dragstart', preventSelection);
      b[addEventListener]('selectstart', preventSelection);
      b[addEventListener]('dragstart', preventSelection);

      a.style.userSelect = 'none';
      a.style.webkitUserSelect = 'none';
      a.style.MozUserSelect = 'none';
      a.style.pointerEvents = 'none';

      b.style.userSelect = 'none';
      b.style.webkitUserSelect = 'none';
      b.style.MozUserSelect = 'none';
      b.style.pointerEvents = 'none';

      self.gutter.style.cursor = options.cursor;
      self.parent.style.cursor = options.cursor;

      calculateSizes.call(self);
    }

    // Set defaults
    if (options === 'undefined') {
      options = {};
    }

    if (options.gutterSize === undefined) { options.gutterSize = 10; }
    if (options.minSize === undefined) { options.minSize = 100; }
    if (options.snapOffset === undefined) { options.snapOffset = 30; }
    if (options.direction === undefined) { options.direction = 'horizontal'; }

    if (options.direction === 'horizontal') {
      dimension = 'width';
      clientDimension = 'clientWidth';
      clientAxis = 'clientX';
      position = 'left';
      gutterClass = 'gutter gutter-horizontal';
      paddingA = 'paddingLeft';
      paddingB = 'paddingRight';
      if (!options.cursor) { options.cursor = 'ew-resize'; }
    } else if (options.direction === 'vertical') {
      dimension = 'height';
      clientDimension = 'clientHeight';
      clientAxis = 'clientY';
      position = 'top';
      gutterClass = 'gutter gutter-vertical';
      paddingA = 'paddingTop';
      paddingB = 'paddingBottom';
      if (!options.cursor) {options.cursor = 'ns-resize'; }
    }

    function fitMin() {
      var
        self = this,
        a = self.a,
        b = self.b;

      if (a[getBoundingClientRect]()[dimension] < self.aMin) {
        a.style[dimension] = (self.aMin - self.aGutterSize) + 'px';
        b.style[dimension] = (self.size - self.aMin - self.aGutterSize) + 'px';
      } else if (b[getBoundingClientRect]()[dimension] < self.bMin) {
        a.style[dimension] = (self.size - self.bMin - self.bGutterSize) + 'px';
        b.style[dimension] = (self.bMin - self.bGutterSize) + 'px';
      }
    }

    function fitMinReverse() {
      var
        self = this,
        a = self.a,
        b = self.b;

      if (b[getBoundingClientRect]()[dimension] < self.bMin) {
        a.style[dimension] = (self.size - self.bMin - self.bGutterSize) + 'px';
        b.style[dimension] = (self.bMin - self.bGutterSize) + 'px';
      } else if (a[getBoundingClientRect]()[dimension] < self.aMin) {
        a.style[dimension] = (self.aMin - self.aGutterSize) + 'px';
        b.style[dimension] = (self.size - self.aMin - self.aGutterSize) + 'px';
      }
    }

    function balancePairs(pairs) {
      var ix;
      for (ix = 0; ix < pairs.length; ix += 1) {
        calculateSizes.call(pairs[ix]);
        fitMin.call(pairs[ix]);
      }

      for (ix = pairs.length - 1; ix >= 0; ix -= 1) {
        calculateSizes.call(pairs[ix]);
        fitMinReverse.call(pairs[ix]);
      }
    }


    // Split() code starts here

    if (!options.sizes) {
      percent = 100 / ids.length;

      options.sizes = [];

      for (i = 0; i < ids.length; i += 1) {
        options.sizes.push(percent);
      }
    }

    if (!Array.isArray(options.minSize)) {
      minSizes = [];

      for (i = 0; i < ids.length; i += 1) {
        minSizes.push(options.minSize);
      }

      options.minSize = minSizes;
    }

    (function () {
      var
        el,
        isFirst,
        isLast,
        size,
        gutter,
        gutterSize = options.gutterSize,
        pair;

      for (i = 0; i < ids.length; i += 1) {
        el = elementOrSelector(ids[i]);
        isFirst = (i === 1);
        isLast = (i === ids.length - 1);

        if (i > 0) {
          pair = {
            a: elementOrSelector(ids[i - 1]),
            b: el,
            aMin: options.minSize[i - 1],
            bMin: options.minSize[i],
            dragging: false,
            parent: parent,
            isFirst: isFirst,
            isLast: isLast,
            direction: options.direction
          };

          // For first and last pairs, first and last gutter width is half.
          pair.aGutterSize = options.gutterSize;
          pair.bGutterSize = options.gutterSize;

          if (isFirst) {
            pair.aGutterSize = options.gutterSize / 2;
          }

          if (isLast) {
            pair.bGutterSize = options.gutterSize / 2;
          }
        }

        // IE9 and above
        if (!isIE8) {
          if (i > 0) {
            gutter = document.createElement('div');

            gutter.className = gutterClass;
            gutter.style[dimension] = options.gutterSize + 'px';

            gutter[addEventListener]('mousedown', startDragging.bind(pair));
            gutter[addEventListener]('touchstart', startDragging.bind(pair));

            parent.insertBefore(gutter, el);

            pair.gutter = gutter;
          }

          if (i === 0 || i === ids.length - 1) {
            gutterSize = options.gutterSize / 2;
          }

          if (typeof options.sizes[i] === 'string' || options.sizes[i] instanceof String) {
            size = options.sizes[i];
          } else {
            size = calc + '(' + options.sizes[i] + '% - ' + gutterSize + 'px)';
          }

          // IE8 and below
        } else {
          if (typeof options.sizes[i] === 'string' || options.sizes[i] instanceof String) {
            size = options.sizes[i];
          } else {
            size = options.sizes[i] + '%';
          }
        }

        el.style[dimension] = size;

        if (i > 0) {
          pairs.push(pair);
        }
      }
    }());

    balancePairs(pairs);
  }; // Split()

  window.Split = Split;

}());

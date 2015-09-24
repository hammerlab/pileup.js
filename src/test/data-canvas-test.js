/* @flow */
'use strict';

var expect = require('chai').expect;

var pileup = require('../main/pileup'),
    {waitFor} = require('./async'),
    dataCanvas = require('../main/data-canvas');

describe('data-canvas', function() {
  var testDiv = document.getElementById('testdiv');
  var canvas;
  before(function() {
    // See https://github.com/facebook/flow/issues/582 
    canvas = (document : any).createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    document.getElementById('testdiv').appendChild(canvas);
  });

  after(function() {
    testDiv.innerHTML = '';  // avoid pollution between tests.
  });

  function rgbAtPos(im: ImageData, x: number, y: number): [number, number, number] {
    var index = y * (im.width * 4) + x * 4;
    return [
      im.data[index],
      im.data[index + 1],
      im.data[index + 2]
    ];
  }

  describe('pass-through canvas', function() {
    it('should put pixels on the canvas', function() {
      if (!canvas) throw 'bad';  // for flow
      var ctx = canvas.getContext('2d');
      var dtx = dataCanvas.getDataContext(ctx);

      dtx.fillStyle = 'red';
      dtx.fillRect(100, 50, 200, 25);
      dtx.pushObject({something: 'or other'});
      dtx.popObject();

      var im = ctx.getImageData(0, 0, 600, 400);
      expect(rgbAtPos(im, 50, 50)).to.deep.equal([0, 0, 0]);
      expect(rgbAtPos(im, 200, 60)).to.deep.equal([255, 0, 0]);
    });
  });

  describe('click tracking context', function() {
    var ctx;
    before(function() {
      if (!canvas) throw 'bad';  // for flow
      ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    });

    function getObjectsAt(draw, x, y) {
      var dtx = new dataCanvas.ClickTrackingContext(ctx, x, y);
      draw(dtx);
      return dtx.hits;
    }

    // To draw any of these:
    // draw(dataCanvas.getDataContext(ctx));

    it('should track clicks on rects', function() {
      function draw(dtx: DataCanvasRenderingContext2D) {
        dtx.pushObject('r');
        dtx.fillStyle = 'red';
        dtx.fillRect(100, 50, 100, 25);
        dtx.popObject();
        dtx.pushObject('b');
        dtx.fillStyle = 'blue';
        dtx.fillRect(300, 100, 200, 25);
        dtx.popObject();
      }

      expect(getObjectsAt(draw, 150, 60)).to.deep.equal([['r']]);
      expect(getObjectsAt(draw, 350, 110)).to.deep.equal([['b']]);
      expect(getObjectsAt(draw, 250, 110)).to.deep.equal([]);
    });

    it('should track clicks on complex shapes', function() {
      function draw(dtx: DataCanvasRenderingContext2D) {
        // This is the upper right half of a rectangle, i.e. a triangle.
        dtx.pushObject('triangle');
        dtx.beginPath();
        dtx.moveTo(100, 100);
        dtx.lineTo(400, 100);
        dtx.lineTo(400, 200);
        dtx.closePath();
        dtx.fill();
        dtx.popObject();
      }

      // This point is in the top right (and hence in the triangle)
      expect(getObjectsAt(draw, 300, 110)).to.deep.equal([['triangle']]);
      // This poitn is in the bottom left (and hence not in the triangle)
      expect(getObjectsAt(draw, 200, 180)).to.deep.equal([]);
    });

    it('should track clicks on stacked shapes', function() {
      function draw(dtx: DataCanvasRenderingContext2D) {
        dtx.pushObject('bottom');
        dtx.fillStyle = 'red';
        dtx.fillRect(100, 50, 400, 100);
        dtx.pushObject('top');
        dtx.fillStyle = 'blue';
        dtx.fillRect(200, 75, 100, 50);
        dtx.popObject();
        dtx.popObject();
        dtx.pushObject('side');
        dtx.fillStyle = 'green';
        dtx.fillRect(450, 75, 100, 50);
        dtx.popObject();
      }

      draw(dataCanvas.getDataContext(ctx));
      expect(getObjectsAt(draw, 110, 60)).to.deep.equal([['bottom']]);
      expect(getObjectsAt(draw, 250, 100)).to.deep.equal([['top', 'bottom'], ['bottom']]);
      expect(getObjectsAt(draw, 475, 100)).to.deep.equal([['side'], ['bottom']]);
    });

    // TODO: tests with drawText()
  });

  describe('RecordingContext', function() {
    var ctx;
    before(function() {
      if (!canvas) throw 'bad';  // for flow
      ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    });

    it('should record calls', function() {
      var dtx = new dataCanvas.RecordingContext(ctx);
      dtx.fillStyle = 'red';
      dtx.pushObject('a');
      dtx.fillRect(100, 50, 200, 25);
      dtx.popObject();

      expect(dtx.calls).to.have.length(3); // push, fill, pop
      expect(dtx.drawnObjectsWith(x => x == 'a')).to.have.length(1);
      expect(dtx.drawnObjectsWith(x => x == 'b')).to.have.length(0);

      // TODO: check drawing styles
    });

    it('should return values from proxied functions', function() {
      var dtx = new dataCanvas.RecordingContext(ctx);
      var metrics = dtx.measureText('Hello');

      expect(dtx.calls).to.deep.equal([['measureText', 'Hello']]);
      expect(metrics.width).to.be.greaterThan(0);
    });
  });
});

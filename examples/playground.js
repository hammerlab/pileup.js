// Try to read a range out of the URL. This is helpful for testing.
function getParameterByName(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
  return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
var pos = getParameterByName('pos');

var range;
if (pos) {
  var m = /(.*):([0-9,]+)-([0-9,]+)/.exec(pos);
  if (!m) { throw 'Invalid range: ' + pos; }
  var makeNum = function(x) { return Number(x.replace(/,/g, '')); };
  range = {contig: m[1], start: makeNum(m[2]), stop: makeNum(m[3])};
} else {
  range = {contig: 'chr17', start: 7512284, stop: 7512644};
}

var p = pileup.create(document.getElementById('pileup'), {
  range: range,
  tracks: sources
});

function jiggle() {
  var r = p.getRange();
  if (r.start % 10 == 0) {
    r.start -= 9;
    r.stop -= 9;
  } else {
    r.start += 1;
    r.stop += 1;
  }

  p.setRange(r);
}

var isJiggling = false;
document.getElementById('jiggle').onclick = function() {
  if (isJiggling) {
    isJiggling = false;
    this.innerHTML = 'FPS test';
    return;
  }

  var repeatedlyJiggle = function() {
    jiggle();
    if (isJiggling) {
      window.requestAnimationFrame(repeatedlyJiggle);
    }
  };

  isJiggling = true;
  this.innerHTML = 'Stop!';
  repeatedlyJiggle();
};

// Measure the frame rate. Chrome devtools can do this, but having the devtools
// open has a dramatic effect on frame rates.
var stats = new Stats();
stats.setMode(0); // 0: fps, 1: ms
document.body.appendChild(stats.domElement);

var update = function() {
  stats.end();
  stats.begin();
  requestAnimationFrame(update);
};
stats.begin();
requestAnimationFrame(update);

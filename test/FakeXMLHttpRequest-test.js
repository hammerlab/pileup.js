var sinon = require('sinon'),
    chai = require('chai'),
    expect = chai.expect;

var FakeXHR = require('./FakeXMLHttpRequest');

describe('FakeXMLHttpRequest', () => {
  beforeEach(() => {
    FakeXHR.install();
  });
  afterEach(() => {
    FakeXHR.restore();
  });

  it('should intercept simple XHRs', (done) => {
    FakeXHR.addResponse('http://example.com/file.txt', 'hello');

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://example.com/file.txt');
    xhr.onload = function(e) {
      expect(this.response).to.equal('hello');
      done();
    };
    xhr.onerror = function(e) {
      throw e;
      done();
    };
    xhr.send();
  });

  it('should intercept arraybuffer XHRs', (done) => {
    var buf = new Uint8Array(4);
    buf[0] = 1;
    buf[1] = 2;
    buf[2] = 3;
    buf[3] = 4;
    FakeXHR.addResponse('http://example.com/file.txt', buf.buffer);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://example.com/file.txt');
    xhr.responseType = 'arraybuffer';
    xhr.onload = function(e) {
      var buf = this.response;
      expect(buf).to.be.an.instanceof(ArrayBuffer);
      expect(buf.byteLength).to.equal(4);
      done();
    };
    xhr.onerror = function(e) {
      throw e;
      done();
    };
    xhr.send();
  });
});

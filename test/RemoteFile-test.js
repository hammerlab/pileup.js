var chai = require('chai'),
    expect = chai.expect;

var FakeXHR = require('./FakeXMLHttpRequest');

var RemoteFile = require('../src/RemoteFile');

describe('RemoteFile', () => {
  beforeEach(() => {
    FakeXHR.install();
  });
  afterEach(() => {
    FakeXHR.restore();
  });

  it('should fetch a subset of a file', (done) => {
    FakeXHR.addResponse('http://example.com/file.txt',
                        new TextEncoder('utf-8').encode('01234567890').buffer);

    var f = new RemoteFile('http://example.com/file.txt');
    var promisedData = f.getBytes(10, 11);

    expect(FakeXHR.numRequests).to.equal(1);
    // expect(req.requestHeaders.Range).to.equal('bytes=10-29');
    promisedData.then(buf => {
      expect(buf.byteLength).to.equal(11);
      done();
    }).done();
  });
});

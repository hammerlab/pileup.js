var chai = require('chai'),
    expect = chai.expect;
var sinon = require('sinon');

var RemoteFile = require('../src/remotefile');

describe('RemoteFile', () => {
  it('should fetch a subset of a file', (done) => {
    var f = new RemoteFile('http://google.com/file.txt');
    var promisedData = f.getBytes(10, 20);

    promisedData.then(buf => {
      expect(buf.byteLength).to.equal(11);
      done();
    });
  });
});

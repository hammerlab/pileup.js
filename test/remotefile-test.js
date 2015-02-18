var chai = require('chai'),
    expect = chai.expect,
    nock = require('nock');

var XMLHttpRequest = require('xhr2');
global.XMLHttpRequest = XMLHttpRequest;

var RemoteFile = require('../src/remotefile');

describe('RemoteFile', () => {
  it('should fetch a subset of a file', (done) => {
    var scope = nock('http://google.com', {
        reqheaders: {
          'Range': 'bytes=10-20'
        }
      })
      .log(console.log)
      .get('/file.txt')
      .reply(206, '0123456789a', {
        'Accept-Ranges': 'bytes',
        'Content-Range': 'bytes 10-20/30'
      });

    var f = new RemoteFile('http://google.com/file.txt');
    var promisedData = f.getBytes(10, 20);

    promisedData.then(buf => {
      expect(buf.byteLength).to.equal(11);
      done();
    });
  });
});

/// <reference path="../typings/chai/chai.d.ts" />
/// <reference path="../typings/sinon/sinon.d.ts" />
/// <reference path="../typings/mocha/mocha.d.ts" />

var expect = chai.expect;

import RemoteFile = require('../src/remotefile');

describe('RemoteFile', () => {
  var server;
  beforeEach(() => { server = sinon.fakeServer.create(); });
  afterEach(()  => { server.restore(); });

  it('should fetch a subset of a file', () => {
    var f = new RemoteFile('http://google.com/file.txt');
    var promisedData = f.getBytes(10, 20);

    expect(server.requests).to.have.length(1);
    var req = server.requests[0];
    console.log(req);
  });
});

/**
 * This is a thin wrapper around RemoteFile which records all network requests.
 * @flow
 */

'use strict';

import type * as Q from 'q';

var RemoteFile = require('../src/RemoteFile'),
    Interval = require('../src/Interval');

class RecordedRemoteFile extends RemoteFile {
  requests: Array<Interval>;

  constructor(url: string) {
    super(url);
    this.requests = [];
  }

  getFromNetwork(start: number, stop: number): Q.Promise<ArrayBuffer> {
    this.requests.push(new Interval(start, stop));
    return super.getFromNetwork(start, stop);
  }
}

module.exports = RecordedRemoteFile;

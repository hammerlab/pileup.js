/**
 * This is a thin wrapper around RemoteFile which records all network requests.
 * @flow
 */

'use strict';

import type * as Q from 'q';

var _ = require('underscore');

var RemoteFile = require('../main/RemoteFile'),
    Interval = require('../main/Interval');

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

  // This sorts & coalesces overlapping requests to facilitate use of
  // scripts/generate_mapped_file.py.
  getRequests(): Array<[number, number]> {
    if (this.requests.length === 0) return [];

    var rs = _.sortBy(this.requests, x => x.start);
    var blocks = [rs[0]];
    for (var i = 1; i < rs.length; i++) {
      var r = rs[i],
          last = blocks[blocks.length - 1];
      if (r.intersects(last)) {
        blocks[blocks.length - 1].stop = r.stop;
      } else {
        blocks.push(r);
      }
    }
    return blocks.map(iv => [iv.start, iv.stop]);
  }
}

module.exports = RecordedRemoteFile;

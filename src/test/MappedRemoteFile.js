/**
 * This class allows testing with extremely large files, without the need to
 * store large files in the git repo.
 *
 * It stores subsets of a file on disk, then maps these back to the original
 * portions of the file.
 *
 * Recommended usage:
 * - In your test, use RecordedRemoteFile with the real remote file.
 *   At the end of the test, console.log remoteFile.getRequests() and copy it.
 * - Generate a mapped file using scripts/generate_mapped_file.py:
 *   pbpaste | ./scripts/generate_mapped_file.py http://path/to/url
 * - Replace RecordedRemoteFile in the test with MappedRemoteFile.
 *
 * @flow
 */
'use strict';

var Q = require('q');

var RemoteFile = require('../main/RemoteFile'),
    Interval = require('../main/Interval');

class MappedRemoteFile extends RemoteFile {
  maps: Array<Interval>;

  constructor(url: string, maps: Array<[number, number]>) {
    super(url);
    this.maps = maps.map(([x, y]) => new Interval(x, y));
    for (var i = 1; i < this.maps.length; i++) {
      var m0 = this.maps[i - 1],
          m1 = this.maps[i];
      if (m0.stop >= m1.start) throw 'Invalid maps';
    }
  }

  getFromNetwork(start: number, stop: number): Q.Promise<ArrayBuffer> {
    // Translate start/stop (which are offsets into the large file) into
    // offsets in the smaller, realized file.
    var originalRequest = new Interval(start, stop),
        request = null;
    var offset = 0;
    for (var i = 0; i < this.maps.length; i++) {
      var m = this.maps[i];
      if (m.containsInterval(originalRequest)) {
        request = new Interval(offset + (start - m.start),
                               offset + (stop - m.start));
        break;
      } else {
        offset += m.length();
      }
    }

    if (request) {
      return super.getFromNetwork(request.start, request.stop).then(buf => {
        // RemoteFile may discover the mapped file length from this request.
        // This results in incorrect behavior, so we force it to forget.
        this.fileLength = -1;
        return buf;
      });
    } else {
      return Q.reject(`Request for ${originalRequest} is not mapped in ${this.url}`);
    }
  }

  getAll(): Q.Promise<ArrayBuffer> {
    return Q.reject('Not implemented');
  }

  getSize(): Q.Promise<number> {
    return Q.reject('Not implemented');
  }
}

module.exports = MappedRemoteFile;

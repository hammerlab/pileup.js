/** @flow */
/**
 * RemoteFile is a representation of a file on a remote server which can be
 * fetched in chunks, e.g. using a Range request.
 */

var Q = require('q');

type Chunk = {
  start: number;
  stop: number;
  buffer: ArrayBuffer;
  // TODO(danvk): priority: number;
}

class RemoteFile {
  url: string;
  fileLength: number;
  chunks: Array<Chunk>;  // regions of file that have already been loaded.

  constructor(url: string) {
    this.url = url;
    this.fileLength = -1;  // unknown
    this.chunks = [];
  }

  getBytes(start: number, length: number): Q.Promise<DataView> {
    var stop = start + length;
    // First check the cache.
    for (var i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i];
      if (chunk.start <= start && chunk.stop >= stop) {
        return Q.when(new DataView(chunk.buffer, start - chunk.start, length));
      }
    }

    // TODO: handle partial overlap of request w/ cache.

    // Need to fetch from the network.
    return this.getFromNetwork(start, start + length - 1);
  }

  getFromNetwork(start: number, stop: number): Q.Promise<DataView> {
    var deferred = Q.defer();

    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.url);
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', `bytes=${start}-${stop}`);
    var remoteFile = this;
    xhr.onload = function(e) {
      console.log('response came back');
      var buffer = this.response;
      var expectLength = stop - start + 1,
          actualLength = buffer.byteLength;
      if (actualLength != expectLength) {
        deferred.reject(`Server returned incorrect number of bytes for ${this.url}. Requested ${start}-${stop} (${expectLength} bytes) but received ${actualLength}.`);
        return;
      }

      var newChunk = { start, stop, buffer };
      remoteFile.chunks.push(newChunk);
      deferred.resolve(new DataView(buffer));
    };

    // TODO: `reject`, `notify` on progress
    console.log('issuing request!');
    xhr.send();

    return deferred.promise;
  }
}

module.exports = RemoteFile;

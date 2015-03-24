
/**
 * RemoteFile is a representation of a file on a remote server which can be
 * fetched in chunks, e.g. using a Range request.
 * @flow
 */
'use strict';

var Q = require('q');

type Chunk = {
  start: number;
  stop: number;
  buffer: ArrayBuffer;
  // TODO(danvk): priority: number;
}

// TODO: support fetching the entire file
// TODO: remember the length of the file when it's learned.

class RemoteFile {
  url: string;
  fileLength: number;
  chunks: Array<Chunk>;  // regions of file that have already been loaded.
  numNetworkRequests: number;  // track this for debugging/testing

  constructor(url: string) {
    this.url = url;
    this.fileLength = -1;  // unknown
    this.chunks = [];
    this.numNetworkRequests = 0;
  }

  getBytes(start: number, length: number): Q.Promise<ArrayBuffer> {
    var stop = start + length - 1;
    // First check the cache.
    for (var i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i];
      if (chunk.start <= start && chunk.stop >= stop) {
        return Q.when(
            chunk.buffer.slice(start - chunk.start, stop - chunk.start + 1));
      }
    }

    // TODO: handle partial overlap of request w/ cache.

    // Need to fetch from the network.
    return this.getFromNetwork(start, stop);
  }

  getFromNetwork(start: number, stop: number): Q.Promise<ArrayBuffer> {
    var deferred = Q.defer();

    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.url);
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', `bytes=${start}-${stop}`);
    var remoteFile = this;
    xhr.onload = function(e) {
      // The actual length of the response may be less than requested if it's
      // too short, e.g. if we request bytes 0-1000 of a 500-byte file.
      // TODO: record the length of the file whenever we learn it and clamp
      // requests to fit within it. The cache is broken at EOF.
      var buffer = this.response;

      var newChunk = { start, stop: start + buffer.byteLength - 1, buffer };
      remoteFile.chunks.push(newChunk);
      deferred.resolve(buffer);
    };

    // TODO: `reject`, `notify` on progress
    this.numNetworkRequests++;
    xhr.send();

    return deferred.promise;
  }

  clearCache() {
    this.chunks = [];
  }
}

module.exports = RemoteFile;

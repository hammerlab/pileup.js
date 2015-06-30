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
    if (length < 0) {
      return Q.reject(`Requested <0 bytes (${length}) from ${this.url}`);
    }

    // If the remote file length is known, clamp the request to fit within it.
    var stop = start + length - 1;
    if (this.fileLength != -1) {
      stop = Math.min(this.fileLength - 1, stop);
    }

    // First check the cache.
    var buf = this.getFromCache(start, stop);
    if (buf) {
      return Q.when(buf);
    }

    // TODO: handle partial overlap of request w/ cache.

    // Need to fetch from the network.
    return this.getFromNetwork(start, stop);
  }

  // Read the entire file -- not recommended for large files!
  getAll(): Q.Promise<ArrayBuffer> {
    // Check cache if file length is available.
    if (this.fileLength != -1) {
      var buf = this.getFromCache(0, this.fileLength - 1);
      if (buf) {
        return Q.when(buf);
      }
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.url);
    xhr.responseType = 'arraybuffer';
    return this.promiseXHR(xhr).then(([buffer]) => {
      this.fileLength = buffer.byteLength;
      this.chunks = [{start: 0, stop: this.fileLength - 1, buffer}];
      return buffer;
    });
  }

  // Reads the entire file as a string (not an ArrayBuffer).
  // This does not use the cache.
  getAllString(): Q.Promise<string> {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.url);
    return this.promiseXHR(xhr).then(([string]) => {
      return string;
    });
  }

  // Returns a promise for the number of bytes in the remote file.
  getSize(): Q.Promise<number> {
    if (this.fileLength != -1) {
      return Q.when(this.fileLength);
    }

    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', this.url);

    return this.promiseXHR(xhr).then(() => {
      // event.total would be better, see facebook/flow#357
      var len = xhr.getResponseHeader('Content-Length');
      if (len !== null) {
        return Number(len);
      } else {
        throw 'Remote resource has unknown length';
      }
    });
  }

  getFromCache(start: number, stop: number): ?ArrayBuffer {
    for (var i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i];
      if (chunk.start <= start && chunk.stop >= stop) {
        return chunk.buffer.slice(start - chunk.start, stop - chunk.start + 1);
      }
    }
    return null;
  }

  getFromNetwork(start: number, stop: number): Q.Promise<ArrayBuffer> {
    var length = stop - start + 1;
    if (length > 50000000) {
      throw `Monster request: Won't fetch ${length} bytes from ${this.url}`;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.url);
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', `bytes=${start}-${stop}`);

    return this.promiseXHR(xhr).then(([buffer]) => {
      // The actual length of the response may be less than requested if it's
      // too short, e.g. if we request bytes 0-1000 of a 500-byte file.
      var newChunk = { start, stop: start + buffer.byteLength - 1, buffer };
      this.chunks.push(newChunk);

      // Record the full file length if it's available.
      var size = this._getLengthFromContentRange(xhr);
      if (size !== null && size !== undefined) {
        if (this.fileLength != -1 && this.fileLength != size) {
          console.warn(`Size of remote file ${this.url} changed from ` +
                       `${this.fileLength} to ${size}`);
        } else {
          this.fileLength = size;
        }
      }

      return buffer;
    });
  }

  // Wrapper to convert XHRs to Promises.
  // The promised values are the response (e.g. an ArrayBuffer) and the Event.
  promiseXHR(xhr: XMLHttpRequest): Q.Promise<[any, Event]> {
    var deferred = Q.defer();
    xhr.addEventListener('load', function(e) {
      if (this.status >= 400) {
        deferred.reject(this.status + ' ' + this.statusText);
      } else {
        deferred.resolve([this.response, e]);
      }
    });
    xhr.addEventListener('error', function(e) {
      deferred.reject("Request failed with status: " + this.status);
    });
    this.numNetworkRequests++;
    xhr.send();
    return deferred.promise;
  }

  // Attempting to access Content-Range directly may raise security errors.
  // This ensures the access is safe before making it.
  _getLengthFromContentRange(xhr: XMLHttpRequest): ?number {
    if (!/Content-Range/i.exec(xhr.getAllResponseHeaders())) {
      return null;
    }

    var contentRange = xhr.getResponseHeader('Content-Range');
    var m = /\/(\d+)$/.exec(contentRange);
    if (m) {
      return Number(m[1]);
    }
    console.warn(`Received improper Content-Range value for ` +
                 `${this.url}: ${contentRange}`);
    return null;
  }

  clearCache() {
    this.chunks = [];
  }
}

module.exports = RemoteFile;

/**
 * LocalFile is a representation of a file that lives locally on disk.
 * @flow
 */
'use strict';

import Q from 'q';
import AbstractFile from './AbstractFile';
var fs = require('fs');
//console.log(fs);

class LocalFile extends AbstractFile {
  fileLength: number;
  path: string;
  buffer: Buffer;  //content of this "File"

  constructor(path: string) {
    super();
    this.path = path;
    this.buffer = fs.readFileSync(path);
    this.fileLength = this.buffer.length;
  }

  getBytesSync(start: number, length: number): ArrayBuffer {
    if (length < 0) {
      return Q.reject(`Requested <0 bytes (${length})`);
    }

    // If the remote file length is known, clamp the request to fit within it.
    var stop = start + length - 1;
    if (this.fileLength != -1) {
      stop = Math.min(this.fileLength - 1, stop);
    }

    // First check the cache.
    return this.getFromCache(start, stop);
  }

  getBytes(start: number, length: number): Q.Promise<ArrayBuffer> {
    if (length < 0) {
      return Q.reject(`Requested <0 bytes (${length})`);
    }

    // If the remote file length is known, clamp the request to fit within it.
    var stop = start + length - 1;
    if (this.fileLength != -1) {
      stop = Math.min(this.fileLength - 1, stop);
    }

    // First check the cache.
    var buf = this.getFromCache(start, stop);
    return Q.when(buf);
  }

  // Read the entire file -- not recommended for large files!
  getAll(): Q.Promise<ArrayBuffer> {
   var buf = this.getFromCache(0, this.fileLength - 1);
   return Q.when(buf);
  }

  // Reads the entire file as a string (not an ArrayBuffer).
  // This does not use the cache.
  getAllString(): Q.Promise<string> {
    return Q.when(this.content);
  }

  // Returns a promise for the number of bytes in the remote file.
  getSize(): Q.Promise<number> {
    return Q.when(this.fileLength);
  }

  getFromCache(start: number, stop: number): ?ArrayBuffer {
    return this.buffer.slice(start, stop + 1);
  }

  clearCache() {}
}

module.exports = LocalFile;

/**
 * AbstractFile is an abstract representation of a file. There are two implementation:
 * 1. RemoteFile  - representation of a file on a remote server which can be
 * fetched in chunks, e.g. using a Range request.
 * 2. LocalStringFile is a representation of a file that was created from input string.
 * Used for testing and small input files.
 * @flow
 */
'use strict';

//import Q from 'q';

class AbstractFile {
  constructor() {
    //how to prevent instantation of this class???
    //this code doesn't pass npm run flow
//    if (new.target === AbstractFile) {
//      throw new TypeError("Cannot construct AbstractFile instances directly");
//    }
  }

  getBytes(start: number, length: number):Object {//: Q.Promise<ArrayBuffer> {
    throw new TypeError("Method getBytes is not implemented");
  }

  // Read the entire file -- not recommended for large files!
  getAll():Object {//: Q.Promise<ArrayBuffer> {
    throw new TypeError("Method getAll is not implemented");
  }

  // Reads the entire file as a string (not an ArrayBuffer).
  // This does not use the cache.
  getAllString():Object {//: Q.Promise<string> {
    throw new TypeError("Method getAllString is not implemented");
  }

  // Returns a promise for the number of bytes in the remote file.
  getSize():Object {//: Q.Promise<number> {
    throw new TypeError("Method getSize is not implemented");
  }
}

module.exports = AbstractFile;

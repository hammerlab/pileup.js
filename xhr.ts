/**
 * A small XHR wrapper with emphasis on features helpful for genomic libraries:
 * - byte range requests
 * - typed arrays
 */

/// <reference path="typings/q/q.d.ts" />

interface ResponseType {
  buffer: ArrayBuffer;
  xhr: XMLHttpRequest;
}

function fetchByteRange(url: string, start: number, stop: number): Q.Promise<ResponseType> {
  var deferred = Q.defer<ResponseType>();

  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.responseType = 'arraybuffer';
  xhr.setRequestHeader('Range', `bytes=${start}-${stop}`);
  xhr.onload = function(e) {
    deferred.resolve({buffer: this.response, xhr: this});
    // var uInt8Array = new Uint8Array(this.response); // this.response == uInt8Array.buffer
    // var byte3 = uInt8Array[4]; // byte at offset 4
  };

  // TODO: `reject`, `notify` on progress

  xhr.send();

  return deferred.promise;
}

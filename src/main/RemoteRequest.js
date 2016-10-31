/**
 * RemoteRequest is a generic endpoint for serving http requests. RemoteRequest
 * handles json data, which is specified by genomic range (contig, start, stop)
 *
 * @flow
 */
'use strict';

import Q from 'q';
import ContigInterval from './ContigInterval';

class RemoteRequest {
  url: string;
  cache: Object;
  numNetworkRequests: number;  // track this for debugging/testing

  constructor(url: string) {
    this.cache = require('memory-cache');
    this.url = url;
    this.numNetworkRequests = 0;
  }

  get(contig: string, start: number, stop: number): Q.Promise<Object> {
    var length = stop - start;
    if (length <= 0) {
      return Q.reject(`Requested <0 interval (${length}) from ${this.url}`);
    }

    // First check the cache.
    var contigInterval = new ContigInterval(contig, start, stop);
    var buf = this.cache.get(contigInterval);
    if (buf) {
      return Q.when(buf);
    }

    // Need to fetch from the network.
    return this.getFromNetwork(contig, start, stop);
  }

  /**
   * Request must be of form "url/contig?start=start&end=stop"
  */
  getFromNetwork(contig: string, start: number, stop: number): Q.Promise<Object> {
    var length = stop - start;
    if (length > 5000000) {
      throw `Monster request: Won't fetch ${length} sized ranges from ${this.url}`;
    }
    var xhr = new XMLHttpRequest();
    var endpoint = this.getEndpointFromContig(contig, start, stop);
    xhr.open('GET', endpoint);
    xhr.responseType = 'json';
    xhr.setRequestHeader('Content-Type', 'application/json');

    return this.promiseXHR(xhr).then(json => {
      // extract response from promise
      var buffer = json[0];
      var contigInterval = new ContigInterval(contig, start, stop);
      this.cache.put(contigInterval, buffer);
      return buffer;
    });
  }

  getEndpointFromContig(contig: string, start: number, stop: number): string {
    return `${this.url}/${contig}?start=${start}&end=${stop}`;
  }

  // Wrapper to convert XHRs to Promises.
  // The promised values are the response (e.g. an ArrayBuffer) and the Event.
  promiseXHR(xhr: XMLHttpRequest): Q.Promise<[any, Event]> {
    var url = this.url;
    var deferred = Q.defer();
    xhr.addEventListener('load', function(e) {
      if (this.status >= 400) {
        deferred.reject(`Request for ${url} failed with status: ${this.status} ${this.statusText}`);
      } else {
        deferred.resolve([this.response, e]);
      }
    });
    xhr.addEventListener('error', function(e) {
      deferred.reject(`Request for ${url} failed with status: ${this.status} ${this.statusText}`);
    });
    this.numNetworkRequests++;
    xhr.send();
    return deferred.promise;
  }
}

module.exports = RemoteRequest;

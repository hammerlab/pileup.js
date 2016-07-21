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
  basePairsPerFetch: number;
  numNetworkRequests: number;  // track this for debugging/testing

  constructor(url: string, basePairsPerFetch: number) {
    this.url = url;
    this.basePairsPerFetch = basePairsPerFetch;
    this.numNetworkRequests = 0;
  }

  expandRange(range: ContigInterval<string>): ContigInterval<string> {
    var roundDown = x => x - x % this.basePairsPerFetch;
    var newStart = Math.max(1, roundDown(range.start())),
        newStop = roundDown(range.stop() + this.basePairsPerFetch - 1);

    return new ContigInterval(range.contig, newStart, newStop);
  }

  getFeaturesInRange(range: ContigInterval<string>, modifier: string = ""): Q.Promise<Object> {
    var expandedRange = this.expandRange(range);
    return this.get(expandedRange, modifier);
  }

  get(range: ContigInterval<string>, modifier: string = ""): Q.Promise<Object> {

    var length = range.stop() - range.start();
    if (length <= 0) {
      return Q.reject(`Requested <0 interval (${length}) from ${this.url}`);
    } else if (length > 5000000) {
      throw `Monster request: Won't fetch ${length} sized ranges from ${this.url}`;
    }
    // get endpoint
    var endpoint = this.getEndpointFromContig(range.contig, range.start(), range.stop(), modifier);
    // Fetch from the network
    return this.getFromNetwork(endpoint);
  }

  /**
   * Request must be of form "url/contig?start=start&end=stop"
  */
  getFromNetwork(endpoint: string): Q.Promise<Object> {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', endpoint);
    xhr.responseType = 'json';
    xhr.setRequestHeader('Content-Type', 'application/json');

    return this.promiseXHR(xhr).then(json => {
      // extract response from promise
      return json[0];
    });
  }

  getEndpointFromContig(contig: string, start: number, stop: number, modifier: string = ""): string {
    if (modifier.length < 1)
      return `${this.url}/${contig}?start=${start}&end=${stop}`;
    else
      return `${this.url}/${contig}?start=${start}&end=${stop}&${modifier}`;
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

/** @flow */

/**
 * Tiny fake for just the portions of XHR level 2 that pileup.js needs.
 * This should be deleted once FauxJax or Sinon support XHR2.
 * (Specifically, we need to let xhr.response be an ArrayBuffer.)
 */
class FakeXMLHttpRequest {
  method: string;
  url: string;
  responseType: string;
  requestHeaders: Object;
  response: any;
  onload: (e: Object) => void;
  onerror: (e: any) => void;

  constructor() {
    this.method = '';
    this.url = '';
    this.responseType = '';
    this.requestHeaders = {};
    this.response = null;
    this.onload = e => {};
    this.onerror = e => {
      throw e;
    };
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(header: string, value: string) {
    this.requestHeaders[header] = value;
  }

  send(): void {
    if (!this.method || !this.url) {
      throw 'must call open() before send()';
    }
    FakeXMLHttpRequest.numRequests++;
    var rs = FakeXMLHttpRequest.responses;
    for (var i = 0; i < rs.length; i++) {
      var url = rs[i][0], response = rs[i][1];
      if (url == this.url) {
        this.response = response;
        window.setTimeout(() => {
          this.onload.call(this, {});
        }, 0);
        break;
      }
    }

    if (!this.response) {
      this.onerror.call(this, 'Unable to find response for ' + this.url);
    }
  }

  static responses: Array<[string, any]>;
  static addResponse(url: string, response: any) {
    var rs = FakeXMLHttpRequest.responses;
    if (!rs) {
      FakeXMLHttpRequest.responses = rs = [];
    }
    rs.push([url, response]);
  }

  static _origXhr: any;
  static numRequests: number;
  static install(): void {
    if (FakeXMLHttpRequest._origXhr) {
      throw "Can't double-install FakeXMLHttpRequest";
    }
    FakeXMLHttpRequest._origXhr = XMLHttpRequest;
    XMLHttpRequest = FakeXMLHttpRequest;
    FakeXMLHttpRequest.numRequests = 0;
  }
  
  static restore(): void {
    if (!FakeXMLHttpRequest._origXhr) {
      throw "Can't restore XMLHttpRequest without installing FakeXMLHttpRequest";
    }

    XMLHttpRequest = FakeXMLHttpRequest._origXhr;
    FakeXMLHttpRequest._origXhr = null;
    FakeXMLHttpRequest.responses = [];
  }
}


module.exports = FakeXMLHttpRequest;

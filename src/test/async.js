/**
 * Primitives to help with async testing.
 * @flow
 */
'use strict';

import Q from 'q';

var WAIT_FOR_POLL_INTERVAL_MS = 100;

// Returns a promise which resolves when predFn() is truthy.
function waitFor<T>(predFn: () => boolean, timeoutMs: number): Q.Promise<(T | null)>{
  var def = Q.defer();

  var checkTimeoutId = null;

  var timeoutId = window.setTimeout(() => {
    if (checkTimeoutId) window.clearTimeout(checkTimeoutId);
    def.reject('Timed out');
  }, timeoutMs);

  var check = function() {
    if (def.promise.isRejected()) return;
    if (predFn()) {
      def.resolve(null);  // no arguments needed
      window.clearTimeout(timeoutId);
    } else {
      checkTimeoutId = window.setTimeout(check, WAIT_FOR_POLL_INTERVAL_MS);
    }
  };
  checkTimeoutId = window.setTimeout(check, 0);

  return def.promise;
}


module.exports = {
  waitFor
};

/**
 * Mocha test helpers
 * @flow
 */

/**
 * Capture warnings & errors on the console and throw them.
 * These typically indicate real problems and shouldn't happen in ordinary
 * pileup use.
 *
 * Call this from inside a Mocha describe() block.
 */
function throwOnWarningsAndErrors() {
  var oldWarn = console.warn,
      oldError = console.error;
  beforeEach(() => {
    console.warn = console.error = function(message) {
      throw message;
    };
  });

  afterEach(() => {
    console.warn = oldWarn;
    console.error = oldError;
  });
}

module.exports = {
  throwOnWarningsAndErrors
};

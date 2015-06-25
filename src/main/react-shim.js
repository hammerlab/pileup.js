/**
 * Workaround for https://github.com/facebook/react/issues/1939
 *
 * Use
 *
 *    var react = require('./react-shim')
 *
 * instead of
 *
 *    var react = require('react')
 *
 * This ensures that the React's ID_ATTRIBUTE_NAME is changed before the
 * library is loaded.
 *
 * @flow
 */
'use strict';

// See https://github.com/facebook/react/issues/1939
require('react/lib/DOMProperty').ID_ATTRIBUTE_NAME = 'data-pileupid';

var react = require('react/addons');

module.exports = react;

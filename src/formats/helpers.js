/**
 * Helpers for specifying file formats using jBinary.
 */
'use strict';

var jBinary = require('jbinary');

// Read a jBinary type at an offset in the buffer specified by another field.
function typeAtOffset(typeName, offsetFieldName) {
  return jBinary.Template({
      baseType: typeName,
      read: function(context) {
        if (+context[offsetFieldName] === 0) {
          return null;
        } else {
          return this.binary.read(this.baseType, +context[offsetFieldName]);
        }
      }
    });
}

module.exports = {typeAtOffset};

/**
 * Helpers for specifying file formats using jBinary.
 */
var jBinary = require('jbinary');

function typeAtOffset(typeName, offsetFieldName) {
  return jBinary.Template({
      baseType: typeName,
      read: function(context) {
        if (+context[offsetFieldName] == 0) {
          return null;
        } else {
          return this.binary.read(this.baseType, +context[offsetFieldName]);
        }
      }
    });
}

module.exports = {typeAtOffset};

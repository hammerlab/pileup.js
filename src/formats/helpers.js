/**
 * Helpers for specifying file formats using jBinary.
 * @flow
 */
'use strict';

var jBinary = require('jbinary');

// Read a jBinary type at an offset in the buffer specified by another field.
function typeAtOffset(baseType: any, offsetFieldName: string) {
  return jBinary.Template({
      baseType: baseType,
      read: function(context) {
        if (+context[offsetFieldName] === 0) {
          return null;
        } else {
          return this.binary.read(this.baseType, +context[offsetFieldName]);
        }
      }
    });
}

// A block of fixed length containing some other type.
// TODO: write this using 'binary' type (like nullString).
var sizedBlock = jBinary.Type({
  params: ['itemType', 'lengthField'],
  resolve: function (getType) {
    this.itemType = getType(this.itemType);
  },
  read: function(context) {
    var pos = this.binary.tell();
    var len = +context[this.lengthField];
    this.binary.skip(len);
    return this.binary.slice(pos, pos + len).read(this.itemType);
  }
});

// A fixed-length string field which is also null-terminated.
// TODO: should be [sizedBlock, 'string0', lengthField]
var nullString = jBinary.Template({
  setParams(lengthField) {
    this.baseType = ['binary', lengthField];
  },
  read() {
    return this.baseRead().read('string0');
  }
});

module.exports = {typeAtOffset, sizedBlock, nullString};

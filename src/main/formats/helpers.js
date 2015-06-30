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
// TODO: file a bug upstream on 'string0', which should do what this does.
var nullString = jBinary.Template({
  setParams(lengthField) {
    this.baseType = ['binary', lengthField];
  },
  read() {
    return this.baseRead().read('string0');
  }
});


// Like 'uint64', but asserts that the number is <2^53 (i.e. fits precisely in
// a float) and reads it as a plain-old-number. This is a performance and
// debugging win, since plain numbers show up more nicely in the console.
var uint64native = jBinary.Template({
  baseType: 'uint64',
  read() {
    var num = this.baseRead(),
        v = +num;
    // Test for wraparound & roundoff
    if (v < 0 || 1 + v == v) {
      throw new RangeError(`Number out of precise floating point range: ${num}`);
    }
    return +num;
  }
});


// Type returned by lazyArray helper, below.
// Has a .length property, a .get() method and a .getAll() method.
class LazyArray {
  bytesPerItem: number;
  jb: Object;
  itemType: Object;
  length: number;

  constructor(jb, bytesPerItem: number, itemType) {
    this.bytesPerItem = bytesPerItem;
    this.jb = jb;
    this.itemType = itemType;
    this.length = this.jb.view.byteLength / this.bytesPerItem;
  }

  get(i) {
    this.jb.seek(i * this.bytesPerItem);
    return this.jb.read(this.itemType);
  }

  getAll() {
    this.jb.seek(0);
    return this.jb.read(['array', this.itemType, this.length]);
  }
}


// Like jBinary's 'array', but defers parsing of items until they are accessed.
// This can result in a huge speedup for large arrays. See LazyArray for the
// resulting type.
var lazyArray = jBinary.Type({
  params: ['itemType', 'bytesPerItem', 'numItems'],
  read() {
    var numItems = this.toValue(this.numItems);
    var bytesPerItem = this.toValue(this.bytesPerItem);
    if (numItems === undefined || bytesPerItem === undefined) {
      throw 'bytesPerItem and numItems must be set for lazyArray';
    }
    var pos = this.binary.tell();
    var len = numItems * bytesPerItem;
    var buffer = this.binary.slice(pos, pos + len);
    this.binary.skip(len);
    return new LazyArray(buffer, bytesPerItem, this.itemType);
  }
});

module.exports = {typeAtOffset, sizedBlock, nullString, uint64native, lazyArray};

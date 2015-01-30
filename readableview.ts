/**
 * Wrapper around an ArrayBuffer which facilitates reading different types of
 * values from it, from start to finish.
 */
class ReadableView {
  offset: number;
  constructor(private dataView: DataView) {
    this.offset = 0;
  }

  // Read an unsigned 8-bit integer and advance the current position.
  readUint8(): number {
    var num = this.dataView.getUint8(this.offset);
    this.offset++;
    return num;
  }

  // Read an unsigned 32-bit integer and advance the current position.
  readUint32(): number {
    var num = this.readUint8() +
              this.readUint8() * (1 << 8) +
              this.readUint8() * (1 << 16) +
              this.readUint8() * (1 << 24);
    return num;
  }

  // Read a sequence of 32-bit integers and advance the current position.
  readUint32Array(n: number): number[] {
    var result: number[] = [];
    for (var i = 0; i < n; i++) {
      result.push(this.readUint32());
    }
    return result;
  }

  /**
   * Extract a sequence of ASCII characters as a string.
   * This throws if any non-ASCII characters are encountered.
   */
  readAscii(length: number): string {
    var result = '';
    for (var i = 0; i < length; i++) {
      var c = this.readUint8();
      if (c > 127) {
        throw 'Encountered non-ASCII character ' + c;
      }
      result += String.fromCharCode(c);
    }
    return result;
  }

  // Returns the number of bytes remaining in the buffer.
  bytesRemaining(): number {
    return this.dataView.byteLength - this.offset;
  }

  // Returns the current offset in the buffer.
  tell(): number {
    return this.offset;
  }
}

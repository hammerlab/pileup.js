/**
 * A virtual offset into a BAM file.
 * This combines the offset to the beginning of the compression block with an
 * offset into the inflated data.
 * These are usually represented as uint64s, which are awkward to work with in
 * JavaScript.
 * @flow
 */

class VirtualOffset {
  coffset: number;
  uoffset: number;

  constructor(coffset: number, uoffset: number) {
    this.coffset = coffset;
    this.uoffset = uoffset;
  }

  toString(): string {
    return `${this.coffset}:${this.uoffset}`;
  }

  isLessThan(other: VirtualOffset): boolean {
    return this.coffset < other.coffset ||
           (this.coffset == other.coffset &&
            this.uoffset < other.uoffset);
  }

  isLessThanOrEqual(other: VirtualOffset): boolean {
    return this.coffset <= other.coffset ||
           (this.coffset == other.coffset &&
            this.uoffset <= other.uoffset);
  }

  isEqual(other: VirtualOffset): boolean {
    return this.coffset == other.coffset &&
           this.uoffset == other.uoffset;
  }

  // Returns <0 if this < other, 0 if this == other, >0 if this > other.
  // Useful for sorting.
  compareTo(other: VirtualOffset): number {
    return this.coffset - other.coffset || this.uoffset - other.uoffset;
  }

  clone(): VirtualOffset {
    return new VirtualOffset(this.coffset, this.uoffset);
  }

  // This is a faster stand-in for jBinary.read('VirtualOffset')
  static fromBlob(u8: Uint8Array, offset?: number): VirtualOffset {
    offset = offset || 0;
    var uoffset = u8[offset    ] +
                  u8[offset + 1] * 256,
        coffset = u8[offset + 2] +
                  u8[offset + 3] * 256 +
                  u8[offset + 4] * 65536 +
                  u8[offset + 5] * 16777216 +
                  u8[offset + 6] * 4294967296 +
                  u8[offset + 7] * 1099511627776;
    return new VirtualOffset(coffset, uoffset);
  }
}

module.exports = VirtualOffset;

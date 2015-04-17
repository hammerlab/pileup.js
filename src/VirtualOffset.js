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
}

module.exports = VirtualOffset;

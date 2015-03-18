// type definitions for (some of) underscore

declare module "underscore" {
  declare function findWhere<T>(list: Array<T>, properties: {}): ?T;
  declare function clone<T>(obj: T): T;

  declare function isEqual<S, T>(a: S, b: T): boolean;
  declare function range(a: number, b: number): Array<number>;
  declare function extend<S, T>(o1: S, o2: T): S & T;

  declare function zip<S, T>(a1: S[], a2: T[]): Array<[S, T]>;

  declare function flatten<S>(a: S[][]): S[];

  declare function chain<S>(obj: S): any;
  declare function any<T>(list: Array<T>, pred: (el: T)=>boolean): boolean;
}


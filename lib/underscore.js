// type definitions for (some of) underscore

declare module "underscore" {
  declare function findWhere<T>(list: Array<T>, properties: {}): ?T;
  declare function clone<T>(obj: T): T;

  declare function isEqual<S, T>(a: S, b: T): boolean;
  declare function range(a: number, b: number): Array<number>;
  declare function extend(...o: Object): Object;

  declare function chain<S>(obj: S): any;
}


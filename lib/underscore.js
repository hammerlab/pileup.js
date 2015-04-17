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

  declare function each<T>(o: {[key:string]: T}, iteratee: (val: T, key: string)=>void): void;
  // declare function each<T>(a: T[], iteratee: (val: T, key: string)=>void): void;

  declare function object<T>(a: Array<[string, T]>): {[key:string]: T};

  declare function every<T>(a: Array<T>, pred: (val: T)=>boolean): boolean;

  declare function initial<T>(a: Array<T>, n?: number): Array<T>;
  declare function rest<T>(a: Array<T>, index?: number): Array<T>;

  declare function sortBy<T>(a: T[], iteratee: (val: T)=>any): T[];

  declare function filter<T>(o: {[key:string]: T}, pred: (val: T, k: string)=>boolean): T[];

  declare function isEmpty(o: any): boolean;

  declare function groupBy<T>(a: Array<T>, iteratee: (val: T, index: number)=>any): {[key:string]: T};
}


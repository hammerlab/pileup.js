// type definitions for (some of) underscore

declare module "underscore" {
  declare function find<T>(list: T[], predicate: (val: T)=>boolean): ?T;
  declare function findWhere<T>(list: Array<T>, properties: {[key:string]: any}): ?T;
  declare function clone<T>(obj: T): T;

  declare function isEqual<S, T>(a: S, b: T): boolean;
  declare function range(a: number, b: number): Array<number>;
  declare function extend<S, T>(o1: S, o2: T): S & T;

  declare function zip<S, T>(a1: S[], a2: T[]): Array<[S, T]>;

  declare function flatten<S>(a: S[][]): S[];

  declare function chain<S>(obj: S): any;
  declare function any<T>(list: Array<T>, pred: (el: T)=>boolean): boolean;

  declare function each<T>(a: T[], iteratee: (val: T, index: number)=>void): void;
  declare function each<K, T>(o: {[key:K]: T}, iteratee: (val: T, key: string)=>void): void;

  declare function map<T, U>(a: T[], iteratee: (val: T, n?: number)=>U): U[];
  declare function map<K, T, U>(a: {[key:K]: T}, iteratee: (val: T, k?: K)=>U): U[];
  declare function map<U>(a: string, iteratee: (val: string, n?: number)=>U): U[];

  declare function object<K, T>(a: Array<[K, T]>): {[key:K]: T};
  declare function object<K, T>(...a: [K, T][]): {[key:K]: T};

  declare function mapObject<K, S, T>(o: {[key:K]:S}, iteratee:(v: S, k?: K)=>T): {[key:K]: T};

  declare function every<T>(a: Array<T>, pred: (val: T)=>boolean): boolean;

  declare function initial<T>(a: Array<T>, n?: number): Array<T>;
  declare function rest<T>(a: Array<T>, index?: number): Array<T>;

  declare function sortBy<T>(a: T[], iteratee: (val: T)=>any): T[];

  declare function filter<T>(o: {[key:string]: T} | Array<T>, pred: (val: T, k: string)=>boolean): T[];

  declare function isEmpty(o: any): boolean;

  declare function groupBy<K, T>(a: Array<T>, iteratee: (val: T, index: number)=>K): {[key:K]: T[]};

  declare function min<T>(a: Array<T>|{[key:any]: T}): T;
  declare function max<T>(a: Array<T>|{[key:any]: T}): T;

  declare function values<T>(o: {[key: any]: T}): T[];
  declare function flatten(a: Array<any>): Array<any>;

  declare function reduce<T, R>(a: T[], fn: (memo: R, val: T, idx: number, list: T[])=>R, memo?: R): R;
  declare function reduce<K, T, R>(a: {[key:K]: T}, fn: (memo: R, val: T, key: K, o: {[key:K]: T})=>R, memo?: R): R;

  declare function uniq<T>(array: T[], isSorted?: boolean, iteratee?: (v: T)=>any): T[];
  declare function unique<T>(array: T[], isSorted?: boolean, iteratee?: (v: T)=>any): T[];

  declare function isString(x: any): boolean;
}

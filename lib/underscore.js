// type definitions for (some of) underscore

declare module "underscore" {
  declare function findWhere<T>(list: Array<T>, properties: {}): ?T;
  declare function clone<T>(obj: T): T;
}


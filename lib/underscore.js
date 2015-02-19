// type definitions for underscore, from http://flowtype.org/docs/third-party.html
declare class UnderscoreStatic {
  findWhere<T>(list: Array<T>, properties: {}): T;
}

declare var _: UnderscoreStatic;

declare function describe(description: string, spec: () => void): void;
declare function it(expectation: string, assertion: (done: () => void) => void): void;
declare function afterEach(fn: () => void): void;

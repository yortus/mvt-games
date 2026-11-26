// What `vitest` is in the preview, for the few visual test files that import
// it. `describe` names the tests inside it, and `beforeAll` runs its setup
// straight away, so a pose finds what it set up. The rest are inert, because
// the preview runs poses, never assertions.
import { describeTests } from './vsnap-stand-in';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export const describe = Object.assign(describeTests, {
    skip: describeTests,
    only: describeTests,
    each: () => describeTests,
    for: () => describeTests,
    skipIf: () => describeTests,
    runIf: () => describeTests,
});

export function beforeAll(setup: () => unknown): void {
    void setup();
}

/** An inert value, which can be read, called or chained, and always returns itself. */
const anything: unknown = new Proxy(() => undefined, { get: () => anything, apply: () => anything });

export const it = anything;
export const test = anything;
export const expect = anything;
export const vi = anything;
export const beforeEach = anything;
export const afterEach = anything;
export const afterAll = anything;
export const onTestFinished = anything;
export const inject = anything;

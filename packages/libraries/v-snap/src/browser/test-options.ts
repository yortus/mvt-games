import type { TestOptions } from 'vitest';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The options of Vitest's `test` that a visual test passes on to it, beside
 * the options of its image.
 */
export type VitestTestOptions = Pick<TestOptions, 'timeout' | 'retry' | 'repeats' | 'fails'>;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Splits a visual test's options into Vitest's, for its `test`, and the
 * rest, for its image. Vitest's always say that the test is not concurrent,
 * since the tests of one page share its renderers and its seeded random
 * numbers.
 */
export function splitTestOptions(options: object): { readonly test: TestOptions; readonly image: Record<string, unknown> } {
    const image: Record<string, unknown> = {};
    const test: Record<string, unknown> = { concurrent: false };
    for (const [key, value] of Object.entries(options)) {
        if (VITEST_KEYS.has(key)) test[key] = value;
        else image[key] = value;
    }
    return { test: test as TestOptions, image };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const VITEST_KEYS: ReadonlySet<string> = new Set<keyof VitestTestOptions>(['timeout', 'retry', 'repeats', 'fails']);

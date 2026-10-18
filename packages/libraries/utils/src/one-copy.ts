import { version } from '../package.json';

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

// A program must load one copy of @mvtjs/utils. Its view tick API keeps state at
// module level: the counts that `tickCounter` exports, and how many times a
// method has been set. Two copies would each keep their own, and quietly
// disagree. So this module, which every program that uses the package loads
// (it is the one `sideEffects` keeps), claims the program as it loads, and
// throws if another copy already has.
//
// The claim is kept where copies of 0.2 to 0.4 record themselves, in the
// same layout, so that this guard finds them too. It records a protocol other
// than theirs, so that one of them loaded later warns that the copies are
// incompatible. Remove that at 1.0, or once those versions have no downloads
// worth counting.

const PACKAGE = '@mvtjs/utils';

/** What copies of 0.2 to 0.4 record as theirs is 1. This copy records another. */
const PROTOCOL = 2;

const registry = copyRegistry();
const other = registry.copies.find((copy) => copy.name === PACKAGE);
if (other !== undefined) throw new Error(describeSecondCopy(other));
registry.copies.push({ name: PACKAGE, version, protocol: PROTOCOL, url: import.meta.url });

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A copy of a package that has loaded, as the record holds it. Copies before 0.5 have no `url`. */
interface LoadedCopy {
    readonly name: string;
    readonly version: string;
    readonly protocol: number;
    readonly url?: string;
}

/** The record of copies loaded, on `globalThis`. Its layout never changes. */
interface CopyRegistry {
    readonly copies: LoadedCopy[];
    readonly warned: Set<string>;
}

function copyRegistry(): CopyRegistry {
    const key = Symbol.for('mvtjs:copies');
    const slots = globalThis as Record<symbol, CopyRegistry | undefined>;
    let found = slots[key];
    if (found === undefined) {
        found = { copies: [], warned: new Set() };
        Object.defineProperty(globalThis, key, { value: found, configurable: true });
    }
    return found;
}

/**
 * The error for a second copy. Copies of one version have a different cause,
 * and a different fix, from copies of two versions, so it says which.
 */
function describeSecondCopy(first: LoadedCopy): string {
    const where = `The first was loaded from ${first.url ?? 'an older copy'}, and this one from ${import.meta.url}.`;
    const reset = 'A test that resets its modules, such as with `vi.resetModules()` or `jest.resetModules()`, '
        + 'loads the package again too. Keep such a test in a file of its own.';
    if (first.version === version) {
        return `[mvt] Two copies of ${PACKAGE} ${version} are loaded, and a program can use only one. ${where} `
            + 'A bundler reached the package by two paths, such as a linked package with its own node_modules, '
            + 'or a dependency that was pre-bundled and also imported directly. '
            + `In Vite, list the @mvtjs packages in \`resolve.dedupe\`, and check \`optimizeDeps\`. ${reset}`;
    }
    return `[mvt] Two copies of ${PACKAGE} are loaded, ${first.version} and ${version}, and a program can use `
        + `only one. ${where} The install nested a second copy. Run \`npm ls ${PACKAGE}\` to find it, then `
        + `\`npm dedupe\`, or add npm \`overrides\` so that every package gets the same version. ${reset}`;
}

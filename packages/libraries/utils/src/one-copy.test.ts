import { afterEach, describe, expect, it } from 'vitest';
import { version } from '../package.json';
// The first copy: the view tick API loads the guard, as every program does
import './view-tick-api';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('a second copy of @mvtjs/utils', () => {
    const registry = copyRegistry();
    const kept = registry.copies.slice();

    afterEach(() => {
        registry.copies.splice(0, registry.copies.length, ...kept);
    });

    it('throws as it loads, naming the version, both copies and the fix, when it is the same version', async () => {
        const error = await loadSecondCopy();
        expect(error.message).toMatch(new RegExp(`^\\[mvt\\] Two copies of @mvtjs/utils ${escaped(version)} are loaded`));
        expect(error.message).toContain('one-copy.ts, and this one from');
        expect(error.message).toContain('resolve.dedupe');
        expect(error.message).toContain('vi.resetModules()');
    });

    it('throws as it loads, naming both versions and the fix, when they differ', async () => {
        registry.copies.splice(0, registry.copies.length, { name: '@mvtjs/utils', version: '0.0.1', protocol: 2, url: 'file:///elsewhere/one-copy.js' });
        const error = await loadSecondCopy();
        expect(error.message).toContain(`Two copies of @mvtjs/utils are loaded, 0.0.1 and ${version}`);
        expect(error.message).toContain('The first was loaded from file:///elsewhere/one-copy.js');
        expect(error.message).toContain('npm ls @mvtjs/utils');
    });

    it('throws after a copy from before 0.5, which records itself in the same place', async () => {
        // As 0.2 to 0.4 record themselves: protocol 1, and no URL
        registry.copies.splice(0, registry.copies.length, { name: '@mvtjs/utils', version: '0.3.0', protocol: 1 });
        const error = await loadSecondCopy();
        expect(error.message).toContain('0.3.0 and');
        expect(error.message).toContain('The first was loaded from an older copy');
    });

    it('records itself with another protocol, so that a copy from before 0.5 loaded later warns', () => {
        const own = kept.find((copy) => copy.name === '@mvtjs/utils');
        expect(own?.protocol).toBe(2);
        expect(own?.version).toBe(version);
        expect(registry.warned).toBeInstanceOf(Set);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The record of copies loaded, as the guard and copies before 0.5 keep it. */
interface CopyRegistry {
    readonly copies: { readonly name: string; readonly version: string; readonly protocol: number; readonly url?: string }[];
    readonly warned: Set<string>;
}

function copyRegistry(): CopyRegistry {
    const found = (globalThis as Record<symbol, CopyRegistry | undefined>)[Symbol.for('mvtjs:copies')];
    if (found === undefined) throw new Error('the guard has not run');
    return found;
}

let copies = 0;

/**
 * Loads the guard again, as a second copy of the package would: a query
 * string makes Vite load a fresh instance of the module. Returns what it
 * threw.
 */
async function loadSecondCopy(): Promise<Error> {
    copies++;
    const path = `./one-copy.ts?copy=${copies}`;
    try {
        await import(/* @vite-ignore */ path);
    }
    catch (error) {
        return error as Error;
    }
    throw new Error('the second copy loaded without throwing');
}

function escaped(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

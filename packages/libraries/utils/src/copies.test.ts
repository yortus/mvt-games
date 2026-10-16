import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL, registerCopy, shareAcrossCopies } from './copies';
import { SKIP_DESCENDANTS, tickCounter } from './tick-api';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('shareAcrossCopies', () => {
    it('gives every caller on one host the object the first one made', () => {
        const host = {};
        const create = vi.fn(() => ({ count: 0 }));
        const first = shareAcrossCopies(host, 'test-share', create);
        const second = shareAcrossCopies(host, 'test-share', create);
        expect(second).toBe(first);
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('keeps hosts, and names, apart', () => {
        const host = {};
        const a = shareAcrossCopies(host, 'test-a', () => ({}));
        expect(shareAcrossCopies({}, 'test-a', () => ({}))).not.toBe(a);
        expect(shareAcrossCopies(host, 'test-b', () => ({}))).not.toBe(a);
    });

    it('adds nothing a for...in loop or Object.keys would see', () => {
        const host = {};
        shareAcrossCopies(host, 'test-hidden', () => ({}));
        expect(Object.keys(host)).toEqual([]);
    });
});

describe('registerCopy', () => {
    it('is silent for copies of the same version', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        registerCopy('test-same', '1.0.0');
        registerCopy('test-same', '1.0.0');
        expect(warn).not.toHaveBeenCalled();
    });

    it('warns once, naming both versions, when another version is loaded', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        registerCopy('test-versions', '1.0.0');
        registerCopy('test-versions', '1.1.0');
        registerCopy('test-versions', '1.2.0');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toMatch(/Two copies of test-versions are loaded: 1\.0\.0 and 1\.1\.0/);
        expect(warn.mock.calls[0][0]).toMatch(/npm dedupe/);
    });

    it('warns of an incompatible copy when the protocols differ', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        registerCopy('test-protocols', '1.0.0');
        // A copy of another protocol, as a later major version would register itself
        const registry = (globalThis as Record<symbol, { copies: unknown[] }>)[Symbol.for('mvtjs:copies')];
        registry.copies.push({ name: 'test-protocols', version: '9.0.0', protocol: PROTOCOL + 1 });
        registerCopy('test-protocols', '1.0.0');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toMatch(/Two incompatible copies of test-protocols/);
    });
});

describe('a second copy of @mvtjs/utils', () => {
    it('shares the first copy\'s state, counters and SKIP_DESCENDANTS', async () => {
        const first = await importModule<{ readonly utilsState: unknown }>('./tick-api/shared-state.ts');
        const second = await importSecondCopy<{ readonly utilsState: unknown }>('./tick-api/shared-state.ts');
        const firstCounter = await importModule<{ readonly tickCounter: unknown }>('./tick-api/tick-counter.ts');
        const secondCounter = await importSecondCopy<{ readonly tickCounter: unknown }>('./tick-api/tick-counter.ts');
        const secondSkip = await importSecondCopy<{ readonly SKIP_DESCENDANTS: symbol }>('./tick-api/skip-descendants.ts');
        expect(secondCounter).not.toBe(firstCounter);
        expect(second).not.toBe(first);
        expect(second.utilsState).toBe(first.utilsState);
        expect(secondCounter.tickCounter).toBe(tickCounter);
        expect(secondSkip.SKIP_DESCENDANTS).toBe(SKIP_DESCENDANTS);
    });

    it('loads silently: it is the same version', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await importSecondCopy('./tick-api/shared-state.ts');
        expect(warn).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let copies = 0;

/**
 * A fresh instance of a module, as a second copy of the package would be: a
 * query string makes Vite load it again, while its own imports resolve to
 * the instances already loaded.
 */
async function importSecondCopy<M>(path: string): Promise<M> {
    copies++;
    return await importModule<M>(`${path}?copy=${copies}`);
}

/** A module by path, past any barrel: the instance a second copy is compared with. */
async function importModule<M>(path: string): Promise<M> {
    return await import(/* @vite-ignore */ path) as M;
}

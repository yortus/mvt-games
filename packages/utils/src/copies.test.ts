import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL, registerCopy, shareAcrossCopies } from './copies';
import * as firstCounter from './scene-counter';
import { utilsState } from './shared-state';
import { SKIP_DESCENDANTS } from './skip-descendants';

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
        const second = await importSecondCopy<typeof import('./shared-state')>('./shared-state.ts');
        const secondCounter = await importSecondCopy<typeof firstCounter>('./scene-counter.ts');
        const secondSkip = await importSecondCopy<typeof import('./skip-descendants')>('./skip-descendants.ts');
        expect(secondCounter).not.toBe(firstCounter);
        expect(second.utilsState).toBe(utilsState);
        expect(secondCounter.sceneCounter).toBe(firstCounter.sceneCounter);
        expect(secondSkip.SKIP_DESCENDANTS).toBe(SKIP_DESCENDANTS);
    });

    it('loads silently: it is the same version', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await importSecondCopy('./shared-state.ts');
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
    return await import(/* @vite-ignore */ `${path}?copy=${copies}`) as M;
}

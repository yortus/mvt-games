// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as first from './element-mixin';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('a second copy of @mvtjs/html', () => {
    it('shares the first copy\'s core', async () => {
        const second = await importCopy('second-copy');
        expect(second).not.toBe(first);
        expect(second.tickScene).toBe(first.tickScene);
        expect(second.setTickMethods).toBe(first.setTickMethods);
        expect(second.destroyElement).toBe(first.destroyElement);
        expect(second.onDestroyed).toBe(first.onDestroyed);
    });

    it('ticks a view set up through the other copy', async () => {
        const second = await importCopy('second-copy');
        const root = document.createElement('div');
        const child = document.createElement('span');
        root.append(child);
        const calls: string[] = [];
        second.setTickMethods(child, { refresh: () => void calls.push('refresh') });
        first.tickScene({ root, only: 'refresh' });
        expect(calls).toEqual(['refresh']);
    });

    it('loads silently: it is the same version', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await importCopy('third-copy');
        expect(warn).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A fresh instance of the module, as a second copy of the package would be: a
 * query string makes Vite load it again, while its own imports resolve to
 * the instances already loaded.
 */
async function importCopy(name: string): Promise<typeof first> {
    const path = `./element-mixin.ts?${name}`;
    return await import(/* @vite-ignore */ path) as typeof first;
}

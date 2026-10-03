import { Object3D } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as first from './object3d-mixin';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('a second copy of @mvtjs/three', () => {
    it('shares the first copy\'s core, and wraps Object3D once', async () => {
        const add = Object3D.prototype.add;
        const second = await importCopy('second-copy');
        expect(second).not.toBe(first);
        expect(second.tickScene).toBe(first.tickScene);
        expect(second.setTickMethods).toBe(first.setTickMethods);
        expect(second.destroyObject).toBe(first.destroyObject);
        expect(second.onDestroyed).toBe(first.onDestroyed);
        expect(Object3D.prototype.add).toBe(add);
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
    const path = `./object3d-mixin.ts?${name}`;
    return await import(/* @vite-ignore */ path) as typeof first;
}

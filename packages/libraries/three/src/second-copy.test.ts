import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import './object3d-mixin';

describe('a second copy of @mvtjs/three', () => {
    it('throws as it loads, saying how to keep one copy', async () => {
        await expect(importCopy('second-copy')).rejects.toThrow(
            /is already registered as a renderer's prototype\. Two copies of a renderer package/,
        );
    });

    it('leaves the first copy\'s registration as it was', async () => {
        const renderer = rendererOf(Object3D.prototype);
        const add = Object3D.prototype.add;
        await importCopy('third-copy').catch(() => undefined);
        expect(rendererOf(Object3D.prototype)).toBe(renderer);
        // Its structural methods are wrapped once, by the first copy
        expect(Object3D.prototype.add).toBe(add);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The registration `updateView` and `refreshView` find on a prototype: a private field, read only here. */
function rendererOf(prototype: object): unknown {
    return (prototype as { _mvtRenderer?: unknown })._mvtRenderer;
}

/**
 * A fresh instance of the module, as a second copy of the package would be: a
 * query string makes Vite load it again, while its own imports resolve to
 * the instances already loaded.
 */
async function importCopy(name: string): Promise<unknown> {
    const path = `./object3d-mixin.ts?${name}`;
    return await import(/* @vite-ignore */ path);
}

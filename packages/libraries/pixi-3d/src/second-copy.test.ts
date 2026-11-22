import { Container3D } from '@pixi/3d';
import { describe, expect, it } from 'vitest';
import './container3d-mixin';

describe('a second copy of @mvtjs/pixi-3d', () => {
    it('throws as it loads, saying how to keep one copy', async () => {
        await expect(importCopy('second-copy')).rejects.toThrow(
            /is already registered as a renderer's prototype\. Two copies of a renderer package/,
        );
    });

    it('leaves the first copy\'s registration as it was', async () => {
        const renderer = rendererOf(Container3D.prototype);
        const addChild = Container3D.prototype.addChild;
        await importCopy('third-copy').catch(() => undefined);
        expect(rendererOf(Container3D.prototype)).toBe(renderer);
        // Its structural methods are wrapped once, by the first copy
        expect(Container3D.prototype.addChild).toBe(addChild);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the registration that `updateView` and `refreshView` find on a prototype. It's a private field, read only here. */
function rendererOf(prototype: object): unknown {
    return (prototype as { _mvtRenderer?: unknown })._mvtRenderer;
}

/**
 * Imports a fresh instance of the module, as a second copy of the package
 * would be. A query string makes Vite load it again, while its own imports
 * resolve to the instances already loaded.
 */
async function importCopy(name: string): Promise<unknown> {
    const path = `./container3d-mixin.ts?${name}`;
    return await import(/* @vite-ignore */ path);
}

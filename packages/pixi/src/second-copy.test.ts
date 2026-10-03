import { Container } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as first from './container-mixin';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('a second copy of @mvtjs/pixi', () => {
    it('shares the first copy\'s registration, and wraps Container once', async () => {
        const addChild = Container.prototype.addChild;
        const renderer = rendererOf(Container.prototype);
        // Registering `Container.prototype` again would throw
        const second = await importCopy('second-copy');
        expect(second).not.toBe(first);
        expect(rendererOf(Container.prototype)).toBe(renderer);
        expect(Container.prototype.addChild).toBe(addChild);
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

/** The registration `updateView` and `refreshView` find on a prototype: a private field, read only here. */
function rendererOf(prototype: object): unknown {
    return (prototype as { _mvtRenderer?: unknown })._mvtRenderer;
}

/**
 * A fresh instance of the module, as a second copy of the package would be: a
 * query string makes Vite load it again, while its own imports resolve to
 * the instances already loaded.
 */
async function importCopy(name: string): Promise<typeof first> {
    const path = `./container-mixin.ts?${name}`;
    return await import(/* @vite-ignore */ path) as typeof first;
}

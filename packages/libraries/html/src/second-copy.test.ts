// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import './element-mixin';

describe('a second copy of @mvtjs/html', () => {
    it('throws as it loads, saying how to keep one copy', async () => {
        await expect(importCopy('second-copy')).rejects.toThrow(
            /is already registered as a renderer's prototype\. Two copies of a renderer package/,
        );
    });

    it('leaves the first copy\'s registration as it was', async () => {
        const renderer = rendererOf(Element.prototype);
        await importCopy('third-copy').catch(() => undefined);
        expect(rendererOf(Element.prototype)).toBe(renderer);
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
    const path = `./element-mixin.ts?${name}`;
    return await import(/* @vite-ignore */ path);
}

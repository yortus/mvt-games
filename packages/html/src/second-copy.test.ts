// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, setRefresh } from '@mvtjs/utils';
import * as first from './element-mixin';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('a second copy of @mvtjs/html', () => {
    it('shares the first copy\'s core', async () => {
        const renderer = rendererOf(Element.prototype);
        // Registering `Element.prototype` again would throw
        const second = await importCopy('second-copy');
        expect(second).not.toBe(first);
        expect(rendererOf(Element.prototype)).toBe(renderer);
        expect(second.destroyElement).toBe(first.destroyElement);
        expect(second.onDestroyed).toBe(first.onDestroyed);
    });

    it('leaves views refreshed as before', async () => {
        await importCopy('second-copy');
        const root = document.createElement('div');
        const child = document.createElement('span');
        root.append(child);
        const calls: string[] = [];
        setRefresh(child, () => void calls.push('refresh'));
        refreshView(root);
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
    const path = `./element-mixin.ts?${name}`;
    return await import(/* @vite-ignore */ path) as typeof first;
}

// @vitest-environment happy-dom
import * as html from '@mvtjs/html';
import * as pixi from '@mvtjs/pixi';
import * as three from '@mvtjs/three';
// eslint-disable-next-line no-restricted-imports -- compares the renderers' re-exports with the base itself
import * as utils from '@mvtjs/utils';
import { describe, expect, it } from 'vitest';

// Each renderer package re-exports the tick API it shares with @mvtjs/utils
// (SKIP_DESCENDANTS, hasUpdate, the counters and the like), so code using one
// renderer imports all of it from one place. Lint holds the site to that, and
// these tests hold the renderers to re-exporting the same names, unchanged.
describe('renderer packages', () => {
    it('re-export the same names from @mvtjs/utils', () => {
        expect(namesFromUtils(three)).toEqual(namesFromUtils(pixi));
        expect(namesFromUtils(html)).toEqual(namesFromUtils(pixi));
        expect(namesFromUtils(pixi)).toContain('SKIP_DESCENDANTS');
    });

    it('re-export the base\'s own values, not copies', () => {
        const renderers: Record<string, unknown>[] = [pixi, three, html];
        for (let i = 0; i < renderers.length; i++) {
            const renderer = renderers[i];
            const names = namesFromUtils(renderer);
            for (let j = 0; j < names.length; j++) {
                expect(renderer[names[j]]).toBe((utils as Record<string, unknown>)[names[j]]);
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The names a renderer package exports that @mvtjs/utils exports too, sorted. */
function namesFromUtils(renderer: Record<string, unknown>): string[] {
    return Object.keys(renderer).filter((name) => name in utils).sort();
}

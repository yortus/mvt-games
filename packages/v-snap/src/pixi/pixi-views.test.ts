import { AbstractRenderer, BatchableGraphics, type Renderer } from 'pixi.js';
import { describe, expect, it } from 'vitest';

// v-snap relies on two details of Pixi that Pixi doesn't promise. These tests
// fail when an update of Pixi changes either one.
describe('the details of Pixi that v-snap relies on', () => {
    it('a reset batch still keeps its roundPixels, which patchPixiPools clears', () => {
        const batch = new BatchableGraphics();
        batch.roundPixels = 1;
        batch.reset();
        expect(batch.roundPixels, 'Pixi now clears roundPixels on reset, so patchPixiPools in pixi-views.ts can go.').toBe(1);
    });

    it('the renderer rounds by its _roundPixels field, which drawPixiImage sets', () => {
        const renderer = Object.create(AbstractRenderer.prototype) as Renderer;
        renderer._roundPixels = 1;
        expect(renderer.roundPixels, 'The renderer no longer reads _roundPixels, which drawPixiImage in pixi-image.ts sets.').toBe(true);
        renderer._roundPixels = 0;
        expect(renderer.roundPixels).toBe(false);
    });
});

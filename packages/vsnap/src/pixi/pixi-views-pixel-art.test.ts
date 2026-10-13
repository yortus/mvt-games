import { Container, TextureSource } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { drawPixiImage } from './pixi-image';
import { pixiViews } from './pixi-views';

// Drawing needs WebGL, which Node lacks, so these tests see only the options
// that pixiViews passes on.
vi.mock('./pixi-image', async (importOriginal) => ({ ...await importOriginal<object>(), drawPixiImage: vi.fn() }));

describe('pixiViews({ pixelArt })', () => {
    it('draws smooth when neither the project nor the test says', () => {
        const kind = pixiViews();
        kind.beforePose?.({});
        expect(TextureSource.defaultOptions.scaleMode).toBe('linear');
    });

    it("makes the project's pixelArt the default for a test whose options don't say", async () => {
        const kind = pixiViews({ pixelArt: true });
        kind.beforePose?.({ width: 40 });
        expect(TextureSource.defaultOptions.scaleMode).toBe('nearest');
        const view = new Container();
        await kind.draw(view, { width: 40, maxPixels: 1000 });
        expect(drawPixiImage).toHaveBeenLastCalledWith(view, { width: 40, maxPixels: 1000, pixelArt: true });
    });

    it("lets a test's own pixelArt override the project's", async () => {
        const kind = pixiViews({ pixelArt: true });
        kind.beforePose?.({ pixelArt: false });
        expect(TextureSource.defaultOptions.scaleMode).toBe('linear');
        const view = new Container();
        await kind.draw(view, { pixelArt: false, maxPixels: 1000 });
        expect(drawPixiImage).toHaveBeenLastCalledWith(view, { pixelArt: false, maxPixels: 1000 });
    });
});

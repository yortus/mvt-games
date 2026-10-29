import { TextureSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { pixiViews } from '../pixi';
import { applyDefaults } from './view-kinds';

// v-snap gives each test its options with its kind's defaults under them
// (applyDefaults), and then runs the kind's steps with them.
describe('pixiViews({ pixelArt, background })', () => {
    it('draws smooth when neither the project nor the test says', () => {
        const kind = pixiViews();
        kind.beforePose?.(applyDefaults(kind.defaults, {}));
        expect(TextureSource.defaultOptions.scaleMode).toBe('linear');
    });

    it("makes the project's options the defaults of a test whose options don't set them", () => {
        const kind = pixiViews({ pixelArt: true, background: 0x101010 });
        const options = applyDefaults(kind.defaults, { width: 40 });
        expect(options).toEqual({ pixelArt: true, background: 0x101010, width: 40 });
        kind.beforePose?.(options);
        expect(TextureSource.defaultOptions.scaleMode).toBe('nearest');
    });

    it("lets a test's own options override the project's, and an undefined option keep the project's", () => {
        const kind = pixiViews({ pixelArt: true, background: 0x101010 });
        expect(applyDefaults(kind.defaults, { pixelArt: false, background: undefined })).toEqual({ pixelArt: false, background: 0x101010 });
    });
});

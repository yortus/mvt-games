import { TextureSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { preparePixiPose } from './pixi-picture';

describe('preparePixiPose', () => {
    it('samples textures nearest-neighbour by default, as pixel art is drawn', () => {
        preparePixiPose({});
        expect(TextureSource.defaultOptions.scaleMode).toBe('nearest');
    });

    it('samples them smoothly for a smooth view', () => {
        preparePixiPose({ isSmooth: true });
        expect(TextureSource.defaultOptions.scaleMode).toBe('linear');
        preparePixiPose({});
    });
});

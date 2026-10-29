import { TextureSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { preparePixiPose } from './pixi-image';

describe('preparePixiPose', () => {
    it('samples textures smoothly by default', () => {
        preparePixiPose({});
        expect(TextureSource.defaultOptions.scaleMode).toBe('linear');
    });

    it('samples textures nearest-neighbour for pixel art', () => {
        preparePixiPose({ pixelArt: true });
        expect(TextureSource.defaultOptions.scaleMode).toBe('nearest');
        preparePixiPose({});
    });
});

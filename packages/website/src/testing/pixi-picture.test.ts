import { TextureSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { preparePixiPose } from './pixi-picture';

describe('preparePixiPose', () => {
    it('refuses pixel art below resolution 1, which would drop whole texels', () => {
        expect(() => preparePixiPose({ pixelArt: true, resolution: 0.5 })).toThrow('Pixel art');
    });

    it('allows a smooth view below resolution 1', () => {
        expect(() => preparePixiPose({ resolution: 0.5 })).not.toThrow();
    });

    it('sets nearest-neighbour textures for pixel art, and linear for the rest', () => {
        preparePixiPose({ pixelArt: true });
        expect(TextureSource.defaultOptions.scaleMode).toBe('nearest');
        preparePixiPose({});
        expect(TextureSource.defaultOptions.scaleMode).toBe('linear');
    });
});

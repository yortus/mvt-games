import { type BufferImageSource, type Sprite } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { hasUpdate, refreshView } from '@mvtjs/pixi';
import { LIGHT_BLUE, PALETTE_RGB } from '../data';
import { createShowModel } from '../models';
import { FRAME_HEIGHT, FRAME_WIDTH } from './chip';
import { ScreenView } from './screen-view';

describe('ScreenView', () => {
    it('shows the boot screen\'s border in the palette\'s light blue, once faded in', () => {
        const model = createShowModel({ startMs: 2000 });
        const view = ScreenView({ model, hasScanlines: false, hasGlow: false, isDebug: false });
        refreshView(view);
        expect(rgbAt(view.children[0] as Sprite, 0, 0)).toBe(PALETTE_RGB[LIGHT_BLUE]);
    });

    it('is black where the show fades between parts', () => {
        const model = createShowModel({ startMs: 0 });
        const view = ScreenView({ model, hasScanlines: false, hasGlow: false, isDebug: false });
        refreshView(view);
        expect(rgbAt(view.children[0] as Sprite, 0, 0)).toBe(0);
    });

    it('doubles every line for scanlines, the copy darker', () => {
        const model = createShowModel({ startMs: 2000 });
        const view = ScreenView({ model, hasScanlines: true, hasGlow: false, isDebug: false });
        refreshView(view);
        const sprite = view.children[0] as Sprite;
        expect(sprite.texture.source.height).toBe(FRAME_HEIGHT * 2);
        expect(rgbAt(sprite, 0, 0)).toBe(PALETTE_RGB[LIGHT_BLUE]);
        expect(rgbAt(sprite, 0, 1)).toBeLessThan(PALETTE_RGB[LIGHT_BLUE]);
        view.destroy({ children: true });
    });

    it('holds no presentation state: it has no update step', () => {
        const view = ScreenView({ model: createShowModel(), hasScanlines: false, hasGlow: false, isDebug: false });
        expect(hasUpdate(view)).toBe(false);
    });
});

/** The pixel at (x, y) of a screen sprite's texture, as 0xRRGGBB. */
function rgbAt(sprite: Sprite, x: number, y: number): number {
    const bytes = (sprite.texture.source as BufferImageSource).resource as Uint8Array;
    const i = (y * FRAME_WIDTH + x) * 4;
    return (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
}

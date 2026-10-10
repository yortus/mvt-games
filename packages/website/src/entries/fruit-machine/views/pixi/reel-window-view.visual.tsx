import { describe } from 'vitest';
import { canvasTest } from '@mvtjs/visual-testing';
import { REEL_STRIPS } from '../../data';
import { loadSymbolArt } from '../art';
import { ReelWindowView } from './reel-window-view';
import { createSymbolTextures, type SymbolTextures } from './symbol-textures';

let textures: Promise<SymbolTextures> | undefined;

/**
 * Returns the symbols' textures, which are made only once. Every file in the
 * run shares the page, and the art takes a moment to draw.
 */
function loadSymbolTextures(): Promise<SymbolTextures> {
    textures ??= loadSymbolArt().then((art) => createSymbolTextures({ art }));
    return textures;
}

describe('ReelWindowView', () => {
    canvasTest('at rest', { artStyle: 'smooth' }, async () => {
        const { textureFor } = await loadSymbolTextures();
        return ReelWindowView({ strips: REEL_STRIPS, positionAt: (reel) => reel * 3, isBlurredAt: () => false, textureFor });
    });

    // Fractional positions show the reels part-way between symbols. The reels
    // are blurred, as they are while they turn.
    canvasTest('spinning', { artStyle: 'smooth' }, async () => {
        const { textureFor } = await loadSymbolTextures();
        return ReelWindowView({ strips: REEL_STRIPS, positionAt: (reel) => 5.4 + reel * 1.7, isBlurredAt: () => true, textureFor });
    });
});

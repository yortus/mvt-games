import { describe } from 'vitest';
import { visualTest } from '#testing';
import { REEL_STRIPS } from '../../data';
import { loadSymbolArt } from '../art';
import { ReelWindowView } from './reel-window-view';
import { createSymbolTextures, type SymbolTextures } from './symbol-textures';

let textures: Promise<SymbolTextures> | undefined;

/** The symbols' textures, made once: every file in the run shares the page, and the art takes a moment to draw. */
function symbolTextures(): Promise<SymbolTextures> {
    textures ??= loadSymbolArt().then((art) => createSymbolTextures({ art }));
    return textures;
}

describe('ReelWindowView', () => {
    visualTest('at rest', async () => {
        const { textureFor } = await symbolTextures();
        return ReelWindowView({ strips: REEL_STRIPS, positionAt: (reel) => reel * 3, isBlurredAt: () => false, textureFor });
    });

    // Fractional positions show the reels part-way between symbols, blurred as they turn
    visualTest('spinning', async () => {
        const { textureFor } = await symbolTextures();
        return ReelWindowView({ strips: REEL_STRIPS, positionAt: (reel) => 5.4 + reel * 1.7, isBlurredAt: () => true, textureFor });
    });
});

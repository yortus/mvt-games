// Spike probe: the wild symbol, large, sharp and blurred.
import { Container, Sprite, Texture } from 'pixi.js';
import { describe } from 'vitest';
import { loadSymbolArt } from '../../src/entries/fruit-machine/views/art';
import { visualTest } from '../harness';

describe('wild', () => {
    visualTest('symbol', async () => {
        const art = await loadSymbolArt({ size: 300 });
        const root = new Container();
        const sharp = new Sprite(Texture.from(art.canvasFor('wild')));
        const blurred = new Sprite(Texture.from(art.blurredCanvasFor('wild')));
        blurred.x = sharp.width + 10;
        root.addChild(sharp, blurred);
        return root;
    });
});

import { type Container, Sprite } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshScene } from '../../../pixi-mvt';
import { createDemoModel, type DemoModel, type GrainStorageKind, TANK_SIZES, type TankSizeKind } from '../models';
import { DemoView } from './demo-view';
import { pickGrainPixel } from './grain-colors';
import type { GrainsViewKind } from './tank-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(grainsView: GrainsViewKind, tankSize: TankSizeKind = 'small', storage: GrainStorageKind = 'objects'): { model: DemoModel; grainsLayer: Container } {
    const model = createDemoModel({ ...TANK_SIZES[tankSize], storage });
    const view = DemoView({ model, grainsView, tankSize, frameStats: () => undefined });
    refreshScene(view);
    const grainsLayer = view.getChildByLabel('grains', true);
    if (grainsLayer === null) throw new Error('no grains layer');
    return { model, grainsLayer };
}

/** Every sprite under `root`, visible or not. */
function collectSprites(root: Container, into: Sprite[] = []): Sprite[] {
    for (let i = 0; i < root.children.length; i++) {
        const child = root.children[i];
        if (child instanceof Sprite) into.push(child);
        collectSprites(child, into);
    }
    return into;
}

/** The pixel view's pixels, one 32-bit RGBA value per cell. */
function readPixels(grainsLayer: Container): Int32Array {
    const sprites = collectSprites(grainsLayer);
    expect(sprites.length).toBe(1);
    const bytes = sprites[0].texture.source.resource as Uint8Array;
    return new Int32Array(bytes.buffer);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('demo view', () => {
    it('draws a sprite per grain, in cells', () => {
        const { model, grainsLayer } = setup('sprites');

        const sprites = collectSprites(grainsLayer).filter((s) => s.visible);
        const { grains } = model;
        expect(sprites.length).toBe(model.grainCount);
        expect(sprites[0].x).toBe(grains.colOf(0));
        expect(sprites[0].y).toBe(grains.rowOf(0));
    });

    it.each(['small', 'large'] as const)('draws a pixel per grain in a %s tank', (tankSize) => {
        const { model, grainsLayer } = setup('pixels', tankSize);
        const { cols, grains } = model;

        const pixels = readPixels(grainsLayer);
        expect(pixels.length).toBe(model.cols * model.rows);
        let lit = 0;
        for (let i = 0; i < pixels.length; i++) if (pixels[i] !== 0) lit++;
        expect(lit).toBe(model.grainCount);
        expect(pixels[grains.rowOf(0) * cols + grains.colOf(0)]).toBe(pickGrainPixel(grains.kindOf(0), 0));
    });

    it('draws the same picture whichever way the model stores its grains', () => {
        const objects = setup('pixels', 'small', 'objects');
        const arrays = setup('pixels', 'small', 'arrays');

        expect(readPixels(arrays.grainsLayer)).toEqual(readPixels(objects.grainsLayer));
    });
});

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

interface SetupOptions {
    readonly grainsView: GrainsViewKind;
    readonly storage?: GrainStorageKind;
    readonly tankSize?: TankSizeKind;
    /** Overrides the tank size's cells, for a smaller, faster tank. */
    readonly cells?: { readonly cols: number; readonly rows: number };
    readonly isReactive?: boolean;
}

interface Setup {
    readonly model: DemoModel;
    readonly view: Container;
    readonly grainsLayer: Container;
}

function setup(options: SetupOptions): Setup {
    const { grainsView, storage = 'objects', tankSize = 'small', isReactive } = options;
    const model = createDemoModel({ ...(options.cells ?? TANK_SIZES[tankSize]), storage });
    const view = DemoView({ model, grainsView, tankSize, isReactive, frameStats: () => undefined });
    refreshScene(view);
    const grainsLayer = view.getChildByLabel('grains', true);
    if (grainsLayer === null) throw new Error('no grains layer');
    return { model, view, grainsLayer };
}

/** Frames of the demo as the runner drives it: pouring sand, then flipping. */
function play({ model, view }: Setup, fromFrame: number, toFrame: number): void {
    for (let f = fromFrame; f < toFrame; f++) {
        if (f === 0) {
            model.tool = 'sand';
            model.startPour(20, 6);
        }
        if (f === 40) model.endPour();
        if (f === 50) model.flip();
        model.movePour(10 + ((f * 3) % 50), 6);
        model.update(1000 / 60);
        refreshScene(view);
    }
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

/** Where the visible sprites are, and their colours, in a stable order. */
function describeSprites(grainsLayer: Container): string[] {
    const sprites = collectSprites(grainsLayer).filter((s) => s.visible);
    return sprites.map((s) => `${s.x},${s.y},${s.tint}`).sort();
}

/** The pixel view's pixels, one 32-bit RGBA value per cell. */
function readPixels(grainsLayer: Container): Int32Array {
    const sprites = collectSprites(grainsLayer);
    expect(sprites.length).toBe(1);
    const bytes = sprites[0].texture.source.resource as Uint8Array;
    return new Int32Array(bytes.buffer);
}

function countLit(pixels: Int32Array): number {
    let lit = 0;
    for (let i = 0; i < pixels.length; i++) if (pixels[i] !== 0) lit++;
    return lit;
}

/** Small, since the store is slow. */
const SMALL_CELLS = { cols: 72, rows: 90 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('demo view', () => {
    it('draws a sprite per grain, in cells', () => {
        const { model, grainsLayer } = setup({ grainsView: 'sprites' });

        const sprites = collectSprites(grainsLayer).filter((s) => s.visible);
        const { grains } = model;
        expect(sprites.length).toBe(model.grainCount);
        expect(sprites[0].x).toBe(grains.colOf(0));
        expect(sprites[0].y).toBe(grains.rowOf(0));
    });

    it.each(['small', 'large'] as const)('draws a pixel per grain in a %s tank', (tankSize) => {
        const { model, grainsLayer } = setup({ grainsView: 'pixels', tankSize });
        const { cols, grains } = model;

        const pixels = readPixels(grainsLayer);
        expect(pixels.length).toBe(model.cols * model.rows);
        expect(countLit(pixels)).toBe(model.grainCount);
        expect(pixels[grains.rowOf(0) * cols + grains.colOf(0)]).toBe(pickGrainPixel(grains.kindOf(0), 0));
    });

    it('draws the same picture whichever way the model stores its grains', () => {
        const objects = setup({ grainsView: 'pixels', storage: 'objects' });
        const arrays = setup({ grainsView: 'pixels', storage: 'arrays' });

        expect(readPixels(arrays.grainsLayer)).toEqual(readPixels(objects.grainsLayer));
    });

    describe('with a store model and SolidJS views', () => {
        it('draws the same pixels as the polled view, frame after frame, pouring and flipping', () => {
            const polled = setup({ grainsView: 'pixels', storage: 'arrays', cells: SMALL_CELLS });
            const reactive = setup({ grainsView: 'pixels', storage: 'store', cells: SMALL_CELLS });
            expect(readPixels(reactive.grainsLayer)).toEqual(readPixels(polled.grainsLayer));

            for (let frame = 0; frame < 120; frame += 10) {
                play(polled, frame, frame + 10);
                play(reactive, frame, frame + 10);
                expect(readPixels(reactive.grainsLayer)).toEqual(readPixels(polled.grainsLayer));
            }
            expect(reactive.model.grainCount).toBeGreaterThan(polled.model.grainCount / 2);
        });

        it('draws the same sprites as the polled view, frame after frame, pouring and flipping', () => {
            const polled = setup({ grainsView: 'sprites', storage: 'arrays', cells: SMALL_CELLS });
            const reactive = setup({ grainsView: 'sprites', storage: 'store', cells: SMALL_CELLS });
            expect(describeSprites(reactive.grainsLayer)).toEqual(describeSprites(polled.grainsLayer));

            for (let frame = 0; frame < 120; frame += 20) {
                play(polled, frame, frame + 20);
                play(reactive, frame, frame + 20);
                expect(describeSprites(reactive.grainsLayer)).toEqual(describeSprites(polled.grainsLayer));
            }
        });

        it('erases every pixel when the tank is cleared, and redraws on reset', () => {
            const { model, view, grainsLayer } = setup({ grainsView: 'pixels', storage: 'store', cells: SMALL_CELLS });
            expect(countLit(readPixels(grainsLayer))).toBe(model.grainCount);

            model.clear();
            refreshScene(view);
            expect(countLit(readPixels(grainsLayer))).toBe(0);

            model.reset();
            refreshScene(view);
            expect(countLit(readPixels(grainsLayer))).toBe(model.grainCount);
        });

        it('can still be polled, to measure the store alone', () => {
            const polledArrays = setup({ grainsView: 'pixels', storage: 'arrays', cells: SMALL_CELLS });
            const polledStore = setup({ grainsView: 'pixels', storage: 'store', cells: SMALL_CELLS, isReactive: false });

            play(polledArrays, 0, 60);
            play(polledStore, 0, 60);

            expect(readPixels(polledStore.grainsLayer)).toEqual(readPixels(polledArrays.grainsLayer));
        });
    });
});

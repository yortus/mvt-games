import { type Container, Sprite } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { countReads, tickScene } from '../../../pixi-mvt';
import {
    createDemoModel, type DemoModel, type GrainStorageKind, TANK_SIZES, type TankSize, type TankSizeKind,
} from '../models';
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
    /** Overrides the tank size's cells and brush, for a smaller, faster tank. */
    readonly tank?: TankSize;
    readonly isReactive?: boolean;
}

interface Setup {
    readonly model: DemoModel;
    readonly view: Container;
    readonly grainsLayer: Container;
}

function setup(options: SetupOptions): Setup {
    const { grainsView, storage = 'objects', tankSize = 'small', isReactive } = options;
    const model = createDemoModel({ ...(options.tank ?? TANK_SIZES[tankSize]), storage });
    const view = DemoView({ model, grainsView, tankSize, isReactive, frameStats: () => undefined });
    tickScene({ root: view, only: 'refresh' });
    const grainsLayer = view.getChildByLabel('grains', true);
    if (grainsLayer === null) throw new Error('no grains layer');
    return { model, view, grainsLayer };
}

/** Frames of the demo as the runner drives it: pouring sand, then flipping. */
function play({ model, view }: Setup, fromFrame: number, toFrame: number): void {
    for (let f = fromFrame; f < toFrame; f++) {
        if (f === 0) {
            model.tool = 'sand';
            model.startPour(8, 3);
        }
        if (f === 25) model.endPour();
        if (f === 30) model.flip();
        model.movePour(4 + ((f * 3) % 16), 3);
        model.update(1000 / 60);
        tickScene({ root: view, only: 'refresh' });
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

/**
 * Small, since the store is slow: about 10 µs per moving grain per step, some
 * 50 times what the others take. A half-size brush keeps the pours in proportion.
 */
const SMALL_TANK: TankSize = { cols: 24, rows: 30, brushScale: 0.5 };

/** Frames `play` takes to pour, flip, land and settle a little. */
const PLAY_FRAMES = 75;

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

    it('counts the same reads per frame whichever way it draws the grains', () => {
        const sprites = setup({ grainsView: 'sprites', tank: SMALL_TANK });
        const pixels = setup({ grainsView: 'pixels', tank: SMALL_TANK });
        play(sprites, 0, 20);
        play(pixels, 0, 20);
        // Some ids empty, so the presence checks count for more than the grains.
        sprites.model.tool = pixels.model.tool = 'erase';
        sprites.model.startPour(12, 28);
        pixels.model.startPour(12, 28);
        sprites.model.update(1000 / 60);
        pixels.model.update(1000 / 60);

        const spriteReads = countReads(() => tickScene({ root: sprites.view, only: 'refresh' }));
        const pixelReads = countReads(() => tickScene({ root: pixels.view, only: 'refresh' }));

        expect(pixels.model.grains.length).toBeGreaterThan(pixels.model.grainCount);
        expect(pixelReads).toBe(spriteReads);
        expect(pixelReads).toBeGreaterThan(3 * pixels.model.grainCount);
    });

    describe('with a store model and SolidJS views', () => {
        it('draws the same pixels as the polled view, frame after frame, pouring and flipping', () => {
            const polled = setup({ grainsView: 'pixels', storage: 'arrays', tank: SMALL_TANK });
            const reactive = setup({ grainsView: 'pixels', storage: 'store', tank: SMALL_TANK });
            expect(readPixels(reactive.grainsLayer)).toEqual(readPixels(polled.grainsLayer));

            for (let frame = 0; frame < PLAY_FRAMES; frame += 15) {
                play(polled, frame, frame + 15);
                play(reactive, frame, frame + 15);
                expect(readPixels(reactive.grainsLayer)).toEqual(readPixels(polled.grainsLayer));
            }
            expect(reactive.model.grainCount).toBeGreaterThan(polled.model.grainCount / 2);
        });

        it('draws the same sprites as the polled view, frame after frame, pouring and flipping', () => {
            const polled = setup({ grainsView: 'sprites', storage: 'arrays', tank: SMALL_TANK });
            const reactive = setup({ grainsView: 'sprites', storage: 'store', tank: SMALL_TANK });
            expect(describeSprites(reactive.grainsLayer)).toEqual(describeSprites(polled.grainsLayer));

            for (let frame = 0; frame < PLAY_FRAMES; frame += 25) {
                play(polled, frame, frame + 25);
                play(reactive, frame, frame + 25);
                expect(describeSprites(reactive.grainsLayer)).toEqual(describeSprites(polled.grainsLayer));
            }
        });

        it('erases every pixel when the tank is cleared, and redraws on reset', () => {
            const { model, view, grainsLayer } = setup({ grainsView: 'pixels', storage: 'store', tank: SMALL_TANK });
            expect(countLit(readPixels(grainsLayer))).toBe(model.grainCount);

            model.clear();
            tickScene({ root: view, only: 'refresh' });
            expect(countLit(readPixels(grainsLayer))).toBe(0);

            model.reset();
            tickScene({ root: view, only: 'refresh' });
            expect(countLit(readPixels(grainsLayer))).toBe(model.grainCount);
        });

        it('can still be polled, to measure the store alone', () => {
            const polledArrays = setup({ grainsView: 'pixels', storage: 'arrays', tank: SMALL_TANK });
            const polledStore = setup({ grainsView: 'pixels', storage: 'store', tank: SMALL_TANK, isReactive: false });

            play(polledArrays, 0, 60);
            play(polledStore, 0, 60);

            expect(readPixels(polledStore.grainsLayer)).toEqual(readPixels(polledArrays.grainsLayer));
        });
    });
});

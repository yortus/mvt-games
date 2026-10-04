import { describe, expect, it } from 'vitest';
import type { GrainStorageKind } from './grain-grid';
import { createDemoModel, type DemoModel, type DemoModelOptions } from './demo-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEP_MS = 1000 / 60;

const STORAGES: readonly GrainStorageKind[] = ['objects', 'arrays', 'store'];

function advance(model: DemoModel, totalMs: number): void {
    const frameMs = 16;
    for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) model.update(frameMs);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.each(STORAGES)('demo model, storing %s', (storage) => {
    const create = (options: DemoModelOptions): DemoModel => createDemoModel({ ...options, storage });
    const setupEmpty = (cols = 40, rows = 40): DemoModel => create({ cols, rows, scene: 'empty' });

    it('stores its grains the way it was asked to', () => {
        expect(setupEmpty().storage).toBe(storage);
    });

    it('opens with the starting scene', () => {
        const model = create({ cols: 60, rows: 80 });

        expect(model.grainCount).toBeGreaterThan(0);
        expect(model.phase).toBe('running');
        expect(model.flipProgress).toBe(0);
    });

    it('can start empty, and resets to empty', () => {
        const model = setupEmpty();
        expect(model.grainCount).toBe(0);

        model.startPour(20, 5);
        advance(model, 100);
        model.reset();

        expect(model.grainCount).toBe(0);
    });

    describe('fixed timestep', () => {
        it('pours the same amount whatever the frame rate', () => {
            const pourFor = (frameCount: number, frameMs: number): number => {
                const model = setupEmpty();
                model.tool = 'sand';
                model.startPour(20, 5);
                for (let i = 0; i < frameCount; i++) model.update(frameMs);
                return model.grainCount;
            };

            // A fifth of a second at 60 frames per second, and at 30.
            expect(pourFor(12, STEP_MS)).toBe(pourFor(6, STEP_MS * 2));
        });

        it('does not step until a whole step of time has passed', () => {
            const model = setupEmpty();
            model.tool = 'sand';
            model.startPour(20, 5);

            model.update(STEP_MS / 2);
            expect(model.grainCount).toBe(0);

            model.update(STEP_MS / 2);
            expect(model.grainCount).toBeGreaterThan(0);
        });

        it('drops the backlog after a stall instead of catching up', () => {
            const model = setupEmpty();
            model.tool = 'sand';
            model.startPour(20, 5);

            model.update(5000);
            const afterStall = model.grainCount;
            // At most 4 steps of up to 24 grains each.
            expect(afterStall).toBeLessThanOrEqual(96);

            model.update(STEP_MS / 2);
            expect(model.grainCount).toBe(afterStall);
        });
    });

    describe('pouring', () => {
        it('pours the selected kind only while pouring', () => {
            const model = setupEmpty();
            model.tool = 'water';
            model.startPour(20, 5);
            advance(model, 100);
            model.endPour();
            const poured = model.grainCount;

            advance(model, 100);

            expect(poured).toBeGreaterThan(0);
            expect(model.grainCount).toBe(poured);
            expect(model.grains.kindOf(0)).toBe('water');
        });

        it('draws an unbroken wall along a fast drag', () => {
            const model = setupEmpty();
            model.tool = 'wall';
            model.startPour(2, 20);
            model.movePour(37, 20);
            model.update(STEP_MS);
            model.endPour();

            const wallCols = new Set<number>();
            const { grains } = model;
            for (let id = 0; id < grains.length; id++) {
                if (grains.at(id) !== undefined && grains.rowOf(id) === 20) wallCols.add(grains.colOf(id));
            }
            for (let col = 2; col <= 37; col++) expect(wallCols.has(col)).toBe(true);
        });

        it('erases grains under the brush', () => {
            const model = create({ cols: 60, rows: 80 });
            const before = model.grainCount;
            model.tool = 'erase';
            model.startPour(30, 78);
            model.update(STEP_MS);
            model.endPour();

            expect(model.grainCount).toBeLessThan(before);
        });

        it('ignores a move when not pouring', () => {
            const model = setupEmpty();
            model.movePour(10, 10);
            expect(model.pourCol).not.toBe(10);
        });
    });

    describe('flipping', () => {
        it('turns the tank over half a second, holding the grains still', () => {
            const model = setupEmpty(10, 10);
            model.tool = 'wall';
            model.startPour(5, 9);
            model.update(STEP_MS);
            model.endPour();
            const col = model.grains.colOf(0);
            const row = model.grains.rowOf(0);

            model.flip();
            advance(model, 240);

            expect(model.phase).toBe('flipping');
            expect(model.flipProgress).toBeCloseTo(240 / 500, 1);
            expect(model.grains.rowOf(0)).toBe(row);

            advance(model, 300);

            expect(model.phase).toBe('running');
            expect(model.flipProgress).toBe(0);
            expect(model.grains.colOf(0)).toBe(9 - col);
            expect(model.grains.rowOf(0)).toBe(9 - row);
        });

        it('ignores a second flip while flipping', () => {
            const model = setupEmpty();
            model.flip();
            advance(model, 400);
            model.flip();
            advance(model, 150);

            expect(model.phase).toBe('running');
        });

        it('pauses pouring while flipping', () => {
            const model = setupEmpty();
            model.tool = 'sand';
            model.flip();
            model.startPour(20, 20);
            advance(model, 400);

            expect(model.grainCount).toBe(0);
        });
    });

    it('clears the tank completely, whatever scene it started with', () => {
        const model = create({ cols: 60, rows: 80 });
        model.flip();
        advance(model, 100);

        model.clear();

        expect(model.grainCount).toBe(0);
        expect(model.movingCount).toBe(0);
        expect(model.phase).toBe('running');
        expect(model.flipProgress).toBe(0);

        model.reset();
        expect(model.grainCount).toBeGreaterThan(0);
    });

    it('resets to the starting scene', () => {
        const model = create({ cols: 30, rows: 40 });
        const opening = model.grainCount;
        model.tool = 'sand';
        model.startPour(15, 5);
        advance(model, 200);
        model.flip();
        advance(model, 100);

        model.reset();

        expect(model.grainCount).toBe(opening);
        expect(model.phase).toBe('running');
        expect(model.flipProgress).toBe(0);
    });
});

describe('tank storages', () => {
    // Small and short, since the store is slow: about 10 µs per moving grain
    // per step, some 50 times what the others take. A half-size brush keeps
    // the pours in proportion.
    const SMALL_TANK = { cols: 20, rows: 24, brushScale: 0.5, scene: 'empty' } as const;

    /** Pour sand then water back and forth across the tank, flipping it part way through. */
    function play(model: DemoModel, fromFrame: number, toFrame: number): void {
        for (let f = fromFrame; f < toFrame; f++) {
            if (f === 0) {
                model.tool = 'sand';
                model.startPour(5, 3);
            }
            if (f === 20) {
                model.endPour();
                model.tool = 'water';
                model.startPour(15, 3);
            }
            if (f === 40) model.flip();
            model.movePour(4 + ((f * 3) % 12), 3);
            model.update(STEP_MS);
        }
    }

    it('behave identically, pouring, flipping and all', () => {
        const objects = createDemoModel({ ...SMALL_TANK, storage: 'objects' });
        const arrays = createDemoModel({ ...SMALL_TANK, storage: 'arrays' });
        const store = createDemoModel({ ...SMALL_TANK, storage: 'store' });

        play(objects, 0, 80);
        play(arrays, 0, 80);
        play(store, 0, 80);

        expect(arrays.save()).toEqual(objects.save());
        expect(store.save()).toEqual(objects.save());
        expect(objects.grainCount).toBeGreaterThan(150);
    });

    it.each([
        ['objects', 'arrays'],
        ['arrays', 'store'],
        ['store', 'objects'],
    ] as const)('resume exactly from each other\'s snapshots, %s to %s', (from, to) => {
        const straight = createDemoModel({ ...SMALL_TANK, storage: from });
        play(straight, 0, 80);

        // Handed over mid-flip.
        const first = createDemoModel({ ...SMALL_TANK, storage: from });
        play(first, 0, 50);
        expect(first.phase).toBe('flipping');
        const second = createDemoModel({ ...SMALL_TANK, storage: to });
        second.load(first.save());
        play(second, 50, 80);

        expect(second.save()).toEqual(straight.save());
    });
});

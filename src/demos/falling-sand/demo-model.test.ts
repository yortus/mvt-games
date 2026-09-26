import { describe, expect, it } from 'vitest';
import { createDemoModel, type DemoModel } from './demo-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEP_MS = 1000 / 60;

function setupEmpty(cols = 40, rows = 40): DemoModel {
    return createDemoModel({ cols, rows, scene: 'empty' });
}

function advance(model: DemoModel, totalMs: number): void {
    const frameMs = 16;
    for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) model.update(frameMs);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('demo model', () => {
    it('opens with the starting scene', () => {
        const model = createDemoModel({ cols: 60, rows: 80 });

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

            // One second at 60 frames per second, and at 30.
            expect(pourFor(60, STEP_MS)).toBe(pourFor(30, STEP_MS * 2));
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
            advance(model, 200);
            model.endPour();
            const poured = model.grainCount;

            advance(model, 200);

            expect(poured).toBeGreaterThan(0);
            expect(model.grainCount).toBe(poured);
            expect(model.grains.at(0)?.kind).toBe('water');
        });

        it('draws an unbroken wall along a fast drag', () => {
            const model = setupEmpty();
            model.tool = 'wall';
            model.startPour(2, 20);
            model.movePour(37, 20);
            model.update(STEP_MS);
            model.endPour();

            const wallCols = new Set<number>();
            for (let id = 0; id < model.grains.length; id++) {
                const grain = model.grains.at(id);
                if (grain?.row === 20) wallCols.add(grain.col);
            }
            for (let col = 2; col <= 37; col++) expect(wallCols.has(col)).toBe(true);
        });

        it('erases grains under the brush', () => {
            const model = createDemoModel({ cols: 60, rows: 80 });
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
            const wall = model.grains.at(0)!;
            const { col, row } = wall;

            model.flip();
            advance(model, 240);

            expect(model.phase).toBe('flipping');
            expect(model.flipProgress).toBeCloseTo(240 / 500, 1);
            expect(wall.row).toBe(row);

            advance(model, 300);

            expect(model.phase).toBe('running');
            expect(model.flipProgress).toBe(0);
            expect(wall.col).toBe(9 - col);
            expect(wall.row).toBe(9 - row);
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
        const model = createDemoModel({ cols: 60, rows: 80 });
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
        const model = createDemoModel({ cols: 60, rows: 80 });
        const opening = model.grainCount;
        model.tool = 'sand';
        model.startPour(30, 5);
        advance(model, 500);
        model.flip();
        advance(model, 100);

        model.reset();

        expect(model.grainCount).toBe(opening);
        expect(model.phase).toBe('running');
        expect(model.flipProgress).toBe(0);
    });
});

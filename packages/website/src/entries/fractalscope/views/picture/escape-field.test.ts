import { describe, expect, it } from 'vitest';
import { type EscapeMeasure, INTERIOR, pickKernel } from '../../models';
import { createEscapeField, type EscapeField, UNKNOWN } from './escape-field';
import { COARSEST_BLOCK } from './picture-constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOME = { centreRe: -0.6, centreIm: 0, width: 3.2 };

function createField(cols = 64, rows = 48, maxIterations = 200): EscapeField {
    return createEscapeField({ measureEscape: pickKernel('mandelbrot'), cols, rows, setting: HOME, maxIterations });
}

/** Advances until the field is complete, and returns the iterations spent. */
function complete(field: EscapeField): number {
    let spent = 0;
    for (let i = 0; i < 1000 && !field.isComplete; i++) spent += field.advance(100000);
    expect(field.isComplete).toBe(true);
    return spent;
}

/** The escape value at the sample nearest `re` + `im`i. */
function escapeNear(field: EscapeField, re: number, im: number): number {
    const unitsPerSample = field.setting.width / field.cols;
    const col = Math.floor((re - field.setting.centreRe) / unitsPerSample + field.cols / 2);
    const row = Math.floor((field.setting.centreIm - im) / unitsPerSample + field.rows / 2);
    return field.escapes[row * field.cols + col];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EscapeField', () => {
    it('starts at the coarsest blocks, with nothing computed', () => {
        const field = createField();

        expect(field.blockSize).toBe(COARSEST_BLOCK);
        expect(field.isComplete).toBe(false);
        expect(field.progress).toBe(0);
    });

    it('fills the whole grid in the first pass, one value per block', () => {
        const field = createField();
        // The first pass is 4 by 3 blocks: cheap, whatever the samples cost
        while (field.blockSize === COARSEST_BLOCK) field.advance(1);

        for (let row = 0; row < 48; row += COARSEST_BLOCK) {
            for (let col = 0; col < 64; col += COARSEST_BLOCK) {
                const corner = field.escapes[row * 64 + col];
                expect(field.escapes[(row + COARSEST_BLOCK - 1) * 64 + col + COARSEST_BLOCK - 1]).toBe(corner);
            }
        }
    });

    it('halves the blocks each pass, until every sample is its own', () => {
        const field = createField();
        const sizes: number[] = [];
        while (!field.isComplete) {
            if (sizes[sizes.length - 1] !== field.blockSize) sizes.push(field.blockSize);
            field.advance(100);
        }

        expect(sizes).toEqual([16, 8, 4, 2, 1]);
        expect(field.blockSize).toBe(0);
        expect(field.progress).toBe(1);
    });

    it('computes each sample once, whatever the budget', () => {
        const small = createField();
        const large = createField();
        while (!small.isComplete) small.advance(50);
        complete(large);

        expect(Array.from(small.escapes)).toEqual(Array.from(large.escapes));
    });

    it('stops close to its budget', () => {
        const field = createField(200, 150, 1000);
        const spent = field.advance(20000);

        // One sample past the budget at most
        expect(spent).toBeGreaterThanOrEqual(20000);
        expect(spent).toBeLessThan(21000);
    });

    it('marks the set\'s own points as interior, and points far outside as escaping fast', () => {
        const field = createField();
        complete(field);

        expect(escapeNear(field, 0, 0)).toBe(INTERIOR);
        expect(escapeNear(field, -1, 0)).toBe(INTERIOR);
        expect(escapeNear(field, -1.9, 1.1)).toBeGreaterThan(0);
        expect(escapeNear(field, -1.9, 1.1)).toBeLessThan(10);
    });

    it('escapes later nearer the set', () => {
        const field = createField(320, 240);
        complete(field);

        expect(escapeNear(field, 0.3, 0)).toBeGreaterThan(escapeNear(field, 0.8, 0));
    });

    it('marks the rows each step changed with the new revision', () => {
        const field = createField();
        const before = field.revision;
        field.advance(1);

        expect(field.revision).toBe(before + 1);
        expect(field.rowRevisions[0]).toBe(field.revision);
        expect(field.rowRevisions[COARSEST_BLOCK - 1]).toBe(field.revision);
        expect(field.rowRevisions[COARSEST_BLOCK]).toBeLessThan(field.revision);
    });

    it('keeps its revision once complete', () => {
        const field = createField();
        complete(field);
        const before = field.revision;
        field.advance(1000);

        expect(field.revision).toBe(before);
    });

    it('starts again over a new setting from its old image, moved to fit', () => {
        const field = createField();
        complete(field);
        const before = Array.from(field.escapes);
        const revision = field.revision;
        // Panned left by exactly four samples
        const shifted = HOME.centreRe - (4 * HOME.width) / 64;

        field.restart({ ...HOME, centreRe: shifted }, 300);

        expect(field.setting.centreRe).toBe(shifted);
        expect(field.maxIterations).toBe(300);
        expect(field.blockSize).toBe(COARSEST_BLOCK);
        expect(field.progress).toBe(0);
        expect(field.revision).toBeGreaterThan(revision);
        for (let row = 0; row < 48; row++) expect(field.rowRevisions[row]).toBe(field.revision);
        // Each row holds the old row's samples, four to the right, with the uncovered edge unknown
        const row = 20 * 64;
        expect(field.escapes[row + 3]).toBe(UNKNOWN);
        expect(field.escapes[row + 10]).toBe(before[row + 6]);
        expect(field.escapes[row + 63]).toBe(before[row + 59]);
    });

    it('never makes its image blockier as it sharpens again', () => {
        const field = createField();
        complete(field);
        field.restart({ ...HOME, centreRe: HOME.centreRe - (4 * HOME.width) / 64 }, 200);
        const moved = Array.from(field.escapes);

        // The first pass, of 16-sample blocks, fills only the uncovered edge
        while (field.blockSize === COARSEST_BLOCK) field.advance(1);
        for (let row = 0; row < 48; row++) {
            for (let col = 4; col < 64; col++) {
                // A block's corner may be computed afresh, at its own point
                if (row % COARSEST_BLOCK === 0 && col % COARSEST_BLOCK === 0) continue;
                expect(field.escapes[row * 64 + col]).toBe(moved[row * 64 + col]);
            }
            expect(field.escapes[row * 64 + 1]).not.toBe(UNKNOWN);
        }
    });

    it('comes out the same, however it got there', () => {
        const direct = createField();
        complete(direct);
        const travelled = createField();
        complete(travelled);
        travelled.restart({ centreRe: 0.3, centreIm: 0.5, width: 0.1 }, 200);
        complete(travelled);
        travelled.restart(HOME, 200);
        complete(travelled);

        expect(Array.from(travelled.escapes)).toEqual(Array.from(direct.escapes));
    });

    it('resizes, keeping its picture and its setting', () => {
        const field = createField();
        complete(field);
        const before = escapeNear(field, -1.9, 1.1);

        field.resize(128, 96);

        expect(field.cols).toBe(128);
        expect(field.rows).toBe(96);
        expect(field.escapes.length).toBe(128 * 96);
        expect(field.rowRevisions.length).toBe(96);
        expect(field.setting).toEqual(HOME);
        expect(field.isComplete).toBe(false);
        expect(escapeNear(field, -1.9, 1.1)).toBe(before);
    });

    it('clears, starting again from nothing', () => {
        const field = createField();
        complete(field);
        const revision = field.revision;
        const elsewhere = { centreRe: 0, centreIm: 0, width: 3.2 };

        field.clear(elsewhere, 250);

        expect(field.setting).toEqual(elsewhere);
        expect(field.maxIterations).toBe(250);
        expect(field.progress).toBe(0);
        expect(field.revision).toBeGreaterThan(revision);
        expect(field.escapes.every((e) => e === UNKNOWN)).toBe(true);
    });

    it('asks the kernel it was given about each point', () => {
        let asked = 0;
        const field = createEscapeField({
            measureEscape: (_re: number, _im: number, _maxIterations: number, measure: EscapeMeasure) => {
                asked++;
                measure.escape = 3;
                measure.iterations = 10;
            },
            cols: 32,
            rows: 32,
            setting: HOME,
            maxIterations: 100,
        });
        complete(field);

        expect(asked).toBe(32 * 32);
        expect(field.escapes.every((e) => e === 3)).toBe(true);
    });

    it('handles a grid that is not a whole number of blocks', () => {
        const field = createField(37, 23);
        complete(field);

        expect(field.progress).toBe(1);
        expect(escapeNear(field, 0, 0)).toBe(INTERIOR);
    });
});

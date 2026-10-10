import { describe, expect, it } from 'vitest';
import { EXACT, reprojectSamples, type SampleGrid, UNKNOWN, UNKNOWN_COARSENESS } from './reproject-samples';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A 4 by 2 grid one unit per sample, centred on the origin, valued by index, every sample exact. */
function createSource(): SampleGrid {
    const escapes = new Float32Array(8);
    for (let i = 0; i < 8; i++) escapes[i] = i;
    return { cols: 4, rows: 2, region: { centerRe: 0, centerIm: 0, span: 4 }, escapes, coarseness: new Uint8Array(8).fill(EXACT) };
}

function createTarget(cols: number, rows: number, centerRe: number, centerIm: number, span: number): SampleGrid {
    return {
        cols,
        rows,
        region: { centerRe, centerIm, span },
        escapes: new Float32Array(cols * rows),
        coarseness: new Uint8Array(cols * rows),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reprojectSamples', () => {
    it('copies a grid onto the same region, as samples one wide', () => {
        const target = createTarget(4, 2, 0, 0, 4);
        reprojectSamples(createSource(), target);

        expect(Array.from(target.escapes)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        expect(Array.from(target.coarseness)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    });

    it('shifts a panned grid, leaving what the source did not cover unknown', () => {
        // Moved one sample right and one up
        const target = createTarget(4, 2, 1, 1, 4);
        reprojectSamples(createSource(), target);

        expect(Array.from(target.escapes)).toEqual([UNKNOWN, UNKNOWN, UNKNOWN, UNKNOWN, 1, 2, 3, UNKNOWN]);
        expect(target.coarseness[0]).toBe(UNKNOWN_COARSENESS);
        expect(target.coarseness[4]).toBe(1);
    });

    it('stretches a zoomed grid, each source sample covering several', () => {
        // Twice as close, about the source's left half
        const target = createTarget(4, 2, -1, 0, 2);
        reprojectSamples(createSource(), target);

        expect(Array.from(target.escapes)).toEqual([0, 0, 1, 1, 4, 4, 5, 5]);
        expect(Array.from(target.coarseness)).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
    });

    it('carries a coarse source sample\'s coarseness through, stretched', () => {
        const source = createSource();
        source.coarseness.fill(4);
        const target = createTarget(4, 2, -1, 0, 2);
        reprojectSamples(source, target);

        expect(target.coarseness[0]).toBe(8);
    });

    it('keeps an unknown sample unknown', () => {
        const source = createSource();
        source.escapes[0] = UNKNOWN;
        source.coarseness[0] = UNKNOWN_COARSENESS;
        const target = createTarget(4, 2, 0, 0, 4);
        reprojectSamples(source, target);

        expect(target.escapes[0]).toBe(UNKNOWN);
        expect(target.coarseness[0]).toBe(UNKNOWN_COARSENESS);
    });
});

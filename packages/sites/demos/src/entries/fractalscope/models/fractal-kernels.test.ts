import { describe, expect, it } from 'vitest';
import { FRACTAL_KINDS, type FractalKind, REST_SETTINGS } from '../data';
import { type EscapeMeasure, INTERIOR, pickKernel } from './fractal-kernels';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** How fast the point `re` + `im`i escapes under the fractal `kind`. */
function escapeOf(kind: FractalKind, re: number, im: number, maxIterations = 500): EscapeMeasure {
    const measure: EscapeMeasure = { escape: 0, iterations: 0 };
    pickKernel(kind)(re, im, maxIterations, measure);
    return measure;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fractal kernels', () => {
    it('has a kernel and a rest setting for every fractal', () => {
        for (const kind of FRACTAL_KINDS) {
            expect(typeof pickKernel(kind), kind).toBe('function');
            expect(REST_SETTINGS[kind].width, kind).toBeGreaterThan(0);
        }
    });

    it('lets a point far outside every fractal escape at once', () => {
        for (const kind of FRACTAL_KINDS) {
            const measure = escapeOf(kind, 40, 40);
            expect(measure.escape, kind).toBeGreaterThanOrEqual(0);
            expect(measure.escape, kind).toBeLessThan(5);
        }
    });

    it('finds a point inside each fractal with an inside, which never escapes and costs every iteration', () => {
        // The spiral Julia set's constant lies just outside the Mandelbrot
        // set, so the Julia set is dust, with no inside at all.
        const inside: { readonly [K in Exclude<FractalKind, 'julia-spiral'>]: readonly [number, number] } = {
            'mandelbrot': [-1.3, 0],
            'burning-ship': [-0.5, 0.5],
            'tricorn': [-0.2, 0],
            'multibrot': [0, 0],
            'celtic': [-0.5, 0],
            'julia-rabbit': [0, 0],
            'phoenix': [-0.7, 0],
        };
        for (const kind of FRACTAL_KINDS) {
            if (kind === 'julia-spiral') continue;
            const [re, im] = inside[kind];
            const measure = escapeOf(kind, re, im, 300);
            expect(measure.escape, kind).toBe(INTERIOR);
            expect(measure.iterations, kind).toBe(300);
        }
    });

    it('lets the centre of the spiral Julia set escape only after hundreds of steps, as dust near the set does', () => {
        const measure = escapeOf('julia-spiral', 0, 0, 1000);

        expect(measure.escape).toBeGreaterThan(100);
    });

    it('settles the Mandelbrot set\'s main cardioid without iterating', () => {
        const measure = escapeOf('mandelbrot', 0, 0, 1000);

        expect(measure.escape).toBe(INTERIOR);
        expect(measure.iterations).toBeLessThan(10);
    });

    it('draws the Mandelbrot set and the Tricorn the same above and below the real axis', () => {
        for (const kind of ['mandelbrot', 'tricorn'] as const) {
            expect(escapeOf(kind, -0.74, 0.18).escape, kind).toBeCloseTo(escapeOf(kind, -0.74, -0.18).escape, 4);
        }
    });

    it('draws a Julia set the same turned half a turn', () => {
        for (const kind of ['julia-rabbit', 'julia-spiral'] as const) {
            expect(escapeOf(kind, 0.31, 0.62).escape, kind).toBeCloseTo(escapeOf(kind, -0.31, -0.62).escape, 4);
        }
    });

    it('draws the Burning Ship the usual way up, as the mirror image of the point', () => {
        // The hull sits above the real axis on screen, and its mirror image escapes
        expect(escapeOf('burning-ship', -0.5, 0.5).escape).toBe(INTERIOR);
        expect(escapeOf('burning-ship', -0.5, -0.5).escape).toBeGreaterThan(0);
    });

    it('gives a deeper point a later escape', () => {
        expect(escapeOf('mandelbrot', 0.3, 0).escape).toBeGreaterThan(escapeOf('mandelbrot', 0.8, 0).escape);
        expect(escapeOf('multibrot', 0.5, 0).escape).toBeGreaterThan(escapeOf('multibrot', 1, 0).escape);
    });
});

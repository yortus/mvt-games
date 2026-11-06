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

    it('lets a point far outside every fractal with an outside escape at once', () => {
        for (const kind of FRACTAL_KINDS) {
            // Under the Newton pinwheel, far away points walk in towards a root,
            // and under the Batik fold, every point is pulled back in.
            if (kind === 'newton-pinwheel' || kind === 'batik-fold') continue;
            const measure = escapeOf(kind, 40, 40);
            expect(measure.escape, kind).toBeGreaterThanOrEqual(0);
            expect(measure.escape, kind).toBeLessThan(5);
        }
    });

    it('finds a point inside each fractal with an inside, which never escapes and costs at least every iteration', () => {
        // The spiral Julia set's constant lies just outside the Mandelbrot
        // set, so the Julia set is dust, with no inside at all. In the circle
        // lace even the holes escape, in the Newton pinwheel everything
        // settles, and in the Batik fold everything wanders.
        const inside: {
            readonly [K in Exclude<FractalKind, 'julia-spiral' | 'circle-lace' | 'newton-pinwheel' | 'batik-fold'>]: readonly [number, number]
        } = {
            'mandelbrot': [-1.3, 0],
            'burning-ship': [-0.5, 0.5],
            'julia-rabbit': [0, 0],
            'phoenix': [-0.7, 0],
        };
        for (const kind of FRACTAL_KINDS) {
            if (kind === 'julia-spiral' || kind === 'circle-lace' || kind === 'newton-pinwheel' || kind === 'batik-fold') continue;
            const [re, im] = inside[kind];
            const measure = escapeOf(kind, re, im, 300);
            expect(measure.escape, kind).toBe(INTERIOR);
            expect(measure.iterations, kind).toBeGreaterThanOrEqual(300);
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

    it('draws the Mandelbrot set the same above and below the real axis', () => {
        expect(escapeOf('mandelbrot', -0.74, 0.18).escape).toBeCloseTo(escapeOf('mandelbrot', -0.74, -0.18).escape, 4);
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
        expect(escapeOf('circle-lace', 1.2, 0).escape).toBeGreaterThan(escapeOf('circle-lace', 3, 0).escape);
    });

    it('draws the circle lace the same turned a quarter turn', () => {
        expect(escapeOf('circle-lace', 0.31, 0.62).escape).toBeCloseTo(escapeOf('circle-lace', -0.62, 0.31).escape, 4);
    });

    it('flings the very middle of the circle lace straight out', () => {
        expect(escapeOf('circle-lace', 0, 0).escape).toBe(0);
    });

    it('mirrors the Batik fold across both axes', () => {
        const value = escapeOf('batik-fold', 0.31, 0.62).escape;

        expect(escapeOf('batik-fold', -0.31, 0.62).escape).toBe(value);
        expect(escapeOf('batik-fold', 0.31, -0.62).escape).toBe(value);
    });

    it('finds a value for every point of the Batik fold, the origin included, however few iterations it has', () => {
        for (const maxIterations of [1, 180, 4000]) {
            for (const [re, im] of [[0, 0], [0.31, 0.62], [1e-13, 1e-13], [40, 40]]) {
                const { escape } = escapeOf('batik-fold', re, im, maxIterations);
                expect(Number.isFinite(escape), String([re, im, maxIterations])).toBe(true);
                expect(escape).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('spends more on the Batik fold as the detail rises', () => {
        expect(escapeOf('batik-fold', 0.3, 0.2, 1000).iterations).toBeGreaterThan(escapeOf('batik-fold', 0.3, 0.2, 200).iterations);
    });

    it('settles each point near a root of the Newton pinwheel on a value of its own', () => {
        const values = new Set<number>();
        for (let root = 0; root < 5; root++) {
            const angle = root * 2 * Math.PI / 5;
            const measure = escapeOf('newton-pinwheel', Math.cos(angle) * 1.001, Math.sin(angle) * 1.001);
            expect(measure.escape).toBeGreaterThanOrEqual(0);
            values.add(Math.round(measure.escape));
        }

        expect(values.size).toBe(5);
    });

    it('never settles the very middle of the Newton pinwheel, where there is no way to go', () => {
        expect(escapeOf('newton-pinwheel', 0, 0).escape).toBe(INTERIOR);
    });

    it('always finds a real value for points of the Newton pinwheel flung off from beside the origin', () => {
        for (let size = 1e-3; size > 1e-14; size /= 10) {
            const { escape } = escapeOf('newton-pinwheel', size, size / 3, 4000);
            expect(Number.isNaN(escape), String(size)).toBe(false);
        }
    });
});

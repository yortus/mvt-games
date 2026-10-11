import { describe, expect, it } from 'vitest';
import { MAX_CENTRE_DRIFT, MIN_MAGNIFICATION, MIN_WIDTH, REST_SETTINGS } from '../data';
import { type EscapeMeasure, INTERIOR } from './fractal-kernels';
import { createScopeModel } from './scope-model';

const REST = REST_SETTINGS['mandelbrot'];

describe('ScopeModel', () => {
    it('starts over the Mandelbrot set, at its rest setting', () => {
        const scope = createScopeModel();

        expect(scope.fractal).toBe('mandelbrot');
        expect(scope.restSetting).toBe(REST);
        expect(scope.centreRe).toBe(REST.centreRe);
        expect(scope.centreIm).toBe(REST.centreIm);
        expect(scope.width).toBe(REST.width);
        expect(scope.magnification).toBe(1);
    });

    it('moves its centre', () => {
        const scope = createScopeModel();
        scope.moveCentre(0.5, -0.25);

        expect(scope.centreRe).toBeCloseTo(REST.centreRe + 0.5);
        expect(scope.centreIm).toBeCloseTo(REST.centreIm - 0.25);
    });

    it('keeps the point it magnifies about where it was', () => {
        const scope = createScopeModel();
        // A point a quarter of the way across, and up a little
        const re = scope.centreRe + scope.width * 0.25;
        const im = scope.centreIm + 0.3;
        const offsetBefore = (re - scope.centreRe) / scope.width;

        scope.magnifyAbout(4, re, im);

        expect(scope.width).toBeCloseTo(REST.width / 4);
        expect(scope.magnification).toBeCloseTo(4);
        expect((re - scope.centreRe) / scope.width).toBeCloseTo(offsetBefore);
        expect((im - scope.centreIm) / scope.width).toBeCloseTo(0.3 / REST.width);
    });

    it('magnifies less as well as more', () => {
        const scope = createScopeModel();
        scope.magnifyAbout(0.5, scope.centreRe, scope.centreIm);

        expect(scope.width).toBeCloseTo(REST.width * 2);
    });

    it('stops at its least and greatest magnification, keeping the point where it was', () => {
        const scope = createScopeModel();
        scope.magnifyAbout(1e20, -0.75, 0.1);

        expect(scope.width).toBe(MIN_WIDTH);
        expect(scope.centreRe).toBeCloseTo(-0.75, 10);
        expect(scope.centreIm).toBeCloseTo(0.1, 10);

        scope.magnifyAbout(1e-20, -0.75, 0.1);
        expect(scope.magnification).toBeCloseTo(MIN_MAGNIFICATION);
    });

    it('ignores a magnification by nothing', () => {
        const scope = createScopeModel();
        scope.magnifyAbout(0, 0, 0);
        scope.magnifyAbout(Number.NaN, 0, 0);

        expect(scope.magnification).toBe(1);
    });

    it('keeps its centre within reach of its rest setting', () => {
        const scope = createScopeModel();
        scope.moveCentre(100, -100);

        expect(scope.centreRe).toBe(REST.centreRe + MAX_CENTRE_DRIFT);
        expect(scope.centreIm).toBe(REST.centreIm - MAX_CENTRE_DRIFT);
    });

    it('recentres, keeping the fractal', () => {
        const scope = createScopeModel();
        scope.chooseFractal('phoenix');
        scope.moveCentre(0.2, 0.2);
        scope.magnifyAbout(8, 0.1, 0.1);
        scope.recentre();

        expect(scope.fractal).toBe('phoenix');
        expect(scope.centreIm).toBe(REST_SETTINGS['phoenix'].centreIm);
        expect(scope.magnification).toBe(1);
    });

    it('changes fractal, going to its rest setting and measuring magnification against it', () => {
        const scope = createScopeModel();
        scope.magnifyAbout(20, -0.75, 0.1);
        scope.chooseFractal('burning-ship');

        const rest = REST_SETTINGS['burning-ship'];
        expect(scope.fractal).toBe('burning-ship');
        expect(scope.restSetting).toBe(rest);
        expect(scope.centreRe).toBe(rest.centreRe);
        expect(scope.width).toBe(rest.width);
        expect(scope.magnification).toBe(1);
    });

    it('changes nothing when the fractal under it is chosen again', () => {
        const scope = createScopeModel();
        scope.magnifyAbout(20, -0.75, 0.1);
        scope.chooseFractal('mandelbrot');

        expect(scope.magnification).toBeCloseTo(20);
    });

    it('measures points under the fractal under it', () => {
        const scope = createScopeModel();
        const measure: EscapeMeasure = { escape: 0, iterations: 0 };

        // Inside the Mandelbrot set, but outside the rabbit Julia set
        scope.measureEscape(-1.3, 0, 300, measure);
        expect(measure.escape).toBe(INTERIOR);

        scope.chooseFractal('julia-rabbit');
        scope.measureEscape(-1.3, 0, 300, measure);
        expect(measure.escape).toBeGreaterThan(0);
    });
});

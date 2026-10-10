import { describe, expect, it } from 'vitest';
import { FRACTAL_HOMES, MAX_CENTER_DRIFT, MAX_ZOOM_OUT, MIN_SPAN } from '../data';
import { createPlaneViewport } from './plane-viewport';

const HOME = FRACTAL_HOMES['mandelbrot'];

describe('PlaneViewport', () => {
    it('starts at home', () => {
        const viewport = createPlaneViewport({ home: HOME });

        expect(viewport.centerRe).toBe(HOME.centerRe);
        expect(viewport.centerIm).toBe(HOME.centerIm);
        expect(viewport.span).toBe(HOME.span);
        expect(viewport.zoom).toBe(1);
        expect(viewport.isAtHome).toBe(true);
    });

    it('pans', () => {
        const viewport = createPlaneViewport({ home: HOME });
        viewport.panBy(0.5, -0.25);

        expect(viewport.centerRe).toBeCloseTo(HOME.centerRe + 0.5);
        expect(viewport.centerIm).toBeCloseTo(HOME.centerIm - 0.25);
        expect(viewport.isAtHome).toBe(false);
    });

    it('keeps the point zoomed about where it was', () => {
        const viewport = createPlaneViewport({ home: HOME });
        // A point a quarter of the way across, and up a little
        const re = viewport.centerRe + viewport.span * 0.25;
        const im = viewport.centerIm + 0.3;
        const offsetBefore = (re - viewport.centerRe) / viewport.span;

        viewport.zoomBy(4, re, im);

        expect(viewport.span).toBeCloseTo(HOME.span / 4);
        expect(viewport.zoom).toBeCloseTo(4);
        expect((re - viewport.centerRe) / viewport.span).toBeCloseTo(offsetBefore);
        expect((im - viewport.centerIm) / viewport.span).toBeCloseTo(0.3 / HOME.span);
    });

    it('zooms out as well as in', () => {
        const viewport = createPlaneViewport({ home: HOME });
        viewport.zoomBy(0.5, viewport.centerRe, viewport.centerIm);

        expect(viewport.span).toBeCloseTo(HOME.span * 2);
    });

    it('stops at the narrowest and widest views, keeping the point where it was', () => {
        const viewport = createPlaneViewport({ home: HOME });
        viewport.zoomBy(1e20, -0.75, 0.1);

        expect(viewport.span).toBe(MIN_SPAN);
        expect(viewport.centerRe).toBeCloseTo(-0.75, 10);
        expect(viewport.centerIm).toBeCloseTo(0.1, 10);

        viewport.zoomBy(1e-20, -0.75, 0.1);
        expect(viewport.span).toBe(HOME.span * MAX_ZOOM_OUT);
    });

    it('ignores a zoom by nothing', () => {
        const viewport = createPlaneViewport({ home: HOME });
        viewport.zoomBy(0, 0, 0);
        viewport.zoomBy(Number.NaN, 0, 0);

        expect(viewport.isAtHome).toBe(true);
    });

    it('keeps its centre within reach of its home', () => {
        const viewport = createPlaneViewport({ home: HOME });
        viewport.panBy(100, -100);

        expect(viewport.centerRe).toBe(HOME.centerRe + MAX_CENTER_DRIFT);
        expect(viewport.centerIm).toBe(HOME.centerIm - MAX_CENTER_DRIFT);
    });

    it('goes home', () => {
        const viewport = createPlaneViewport({ home: HOME });
        viewport.panBy(0.2, 0.2);
        viewport.zoomBy(10, 0, 0);
        viewport.reset();

        expect(viewport.isAtHome).toBe(true);
    });

    it('moves to a new home, and measures its zoom against it', () => {
        const viewport = createPlaneViewport({ home: HOME });
        viewport.zoomBy(10, 0, 0);
        const ship = FRACTAL_HOMES['burning-ship'];
        viewport.goHome(ship);

        expect(viewport.home).toBe(ship);
        expect(viewport.centerRe).toBe(ship.centerRe);
        expect(viewport.span).toBe(ship.span);
        expect(viewport.zoom).toBe(1);
        expect(viewport.isAtHome).toBe(true);
    });
});

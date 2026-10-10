import { describe, expect, it } from 'vitest';
import { HOME_CENTER_IM, HOME_CENTER_RE, HOME_SPAN, MAX_CENTER_DRIFT, MAX_SPAN, MIN_SPAN } from '../data';
import { createPlaneViewport } from './plane-viewport';

describe('PlaneViewport', () => {
    it('starts at home', () => {
        const viewport = createPlaneViewport();

        expect(viewport.centerRe).toBe(HOME_CENTER_RE);
        expect(viewport.centerIm).toBe(HOME_CENTER_IM);
        expect(viewport.span).toBe(HOME_SPAN);
        expect(viewport.zoom).toBe(1);
        expect(viewport.isAtHome).toBe(true);
    });

    it('pans', () => {
        const viewport = createPlaneViewport();
        viewport.panBy(0.5, -0.25);

        expect(viewport.centerRe).toBeCloseTo(HOME_CENTER_RE + 0.5);
        expect(viewport.centerIm).toBeCloseTo(HOME_CENTER_IM - 0.25);
        expect(viewport.isAtHome).toBe(false);
    });

    it('keeps the point zoomed about where it was', () => {
        const viewport = createPlaneViewport();
        // A point a quarter of the way across, and up a little
        const re = viewport.centerRe + viewport.span * 0.25;
        const im = viewport.centerIm + 0.3;
        const offsetBefore = (re - viewport.centerRe) / viewport.span;

        viewport.zoomBy(4, re, im);

        expect(viewport.span).toBeCloseTo(HOME_SPAN / 4);
        expect(viewport.zoom).toBeCloseTo(4);
        expect((re - viewport.centerRe) / viewport.span).toBeCloseTo(offsetBefore);
        expect((im - viewport.centerIm) / viewport.span).toBeCloseTo(0.3 / HOME_SPAN);
    });

    it('zooms out as well as in', () => {
        const viewport = createPlaneViewport();
        viewport.zoomBy(0.5, viewport.centerRe, viewport.centerIm);

        expect(viewport.span).toBeCloseTo(HOME_SPAN * 2);
    });

    it('stops at the narrowest and widest views, keeping the point where it was', () => {
        const viewport = createPlaneViewport();
        viewport.zoomBy(1e20, -0.75, 0.1);

        expect(viewport.span).toBe(MIN_SPAN);
        expect(viewport.centerRe).toBeCloseTo(-0.75, 10);
        expect(viewport.centerIm).toBeCloseTo(0.1, 10);

        viewport.zoomBy(1e-20, -0.75, 0.1);
        expect(viewport.span).toBe(MAX_SPAN);
    });

    it('ignores a zoom by nothing', () => {
        const viewport = createPlaneViewport();
        viewport.zoomBy(0, 0, 0);
        viewport.zoomBy(Number.NaN, 0, 0);

        expect(viewport.isAtHome).toBe(true);
    });

    it('keeps its centre within reach of the set', () => {
        const viewport = createPlaneViewport();
        viewport.panBy(100, -100);

        expect(viewport.centerRe).toBe(HOME_CENTER_RE + MAX_CENTER_DRIFT);
        expect(viewport.centerIm).toBe(HOME_CENTER_IM - MAX_CENTER_DRIFT);
    });

    it('goes home', () => {
        const viewport = createPlaneViewport();
        viewport.panBy(0.2, 0.2);
        viewport.zoomBy(10, 0, 0);
        viewport.reset();

        expect(viewport.isAtHome).toBe(true);
    });
});

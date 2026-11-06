import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/html';
import {
    FRACTAL_KINDS,
    MAX_CENTRE_DRIFT,
    MAX_RECENTRE_MS,
    MIN_MAGNIFICATION,
    MIN_RECENTRE_MS,
    MIN_WIDTH,
    REST_SETTINGS,
    TRAVEL_RATE,
    ZOOM_RATE,
} from '../data';
import { type EscapeMeasure, INTERIOR } from './fractal-kernels';
import { createScopeModel, type ScopeModel } from './scope-model';

const REST = REST_SETTINGS['mandelbrot'];

/** How long a recentre takes from `scope`'s setting now, to the millisecond. */
function timeRecentre(scope: ScopeModel): number {
    scope.recentre();
    let elapsedMs = 0;
    while (scope.isMoving) {
        scope.update(1);
        elapsedMs++;
    }
    return elapsedMs;
}

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

    it('eases back to its rest setting, keeping the fractal', async () => {
        const scope = createScopeModel();
        scope.chooseFractal('phoenix');
        scope.moveCentre(0.2, 0.2);
        scope.magnifyAbout(8, 0.1, 0.1);
        const magnified = scope.magnification;
        scope.recentre();

        expect(scope.magnification).toBe(magnified);
        await advanceTime(MIN_RECENTRE_MS / 2, scope);
        expect(scope.magnification).toBeLessThan(magnified);
        expect(scope.magnification).toBeGreaterThan(1);

        await advanceTime(MAX_RECENTRE_MS, scope);
        expect(scope.fractal).toBe('phoenix');
        expect(scope.centreIm).toBe(REST_SETTINGS['phoenix'].centreIm);
        expect(scope.magnification).toBe(1);
    });

    it('is half way back at half time, zooming evenly', () => {
        const timed = createScopeModel();
        timed.magnifyAbout(16, REST.centreRe, REST.centreIm);
        const lengthMs = timeRecentre(timed);

        const scope = createScopeModel();
        scope.magnifyAbout(16, REST.centreRe, REST.centreIm);
        scope.recentre();
        scope.update(lengthMs / 2);

        expect(scope.magnification).toBeCloseTo(4, 1);
    });

    it('keeps the view steady from deep in, so that the centre waits for the width', () => {
        const scope = createScopeModel();
        const re = -0.7436;
        const im = 0.1318;
        scope.moveCentre(re - REST.centreRe, im - REST.centreIm);
        scope.magnifyAbout(1e10, re, im);
        scope.recentre();
        const widthAtStart = scope.width;
        scope.update(MIN_RECENTRE_MS / 4);

        // However far the view has zoomed out, the point it started on is still in it.
        expect(Math.abs(scope.centreRe - re)).toBeLessThan(scope.width);
        expect(Math.abs(scope.centreIm - im)).toBeLessThan(scope.width);
        expect(scope.width).toBeGreaterThan(widthAtStart);
    });

    it('takes the shortest time to recentre when it isn\'t magnified', () => {
        const panned = createScopeModel();
        panned.moveCentre(1, 0);
        expect(timeRecentre(panned)).toBe(MIN_RECENTRE_MS);

        const pulledBack = createScopeModel();
        pulledBack.magnifyAbout(MIN_MAGNIFICATION, REST.centreRe, REST.centreIm);
        expect(timeRecentre(pulledBack)).toBe(MIN_RECENTRE_MS);
    });

    it('takes the longest time to recentre from the strongest magnification, whichever the fractal', () => {
        for (const kind of FRACTAL_KINDS) {
            const scope = createScopeModel();
            scope.chooseFractal(kind);
            scope.magnifyAbout(1e30, scope.centreRe, scope.centreIm);

            expect(timeRecentre(scope), kind).toBe(MAX_RECENTRE_MS);
        }
    });

    it('adds the same time to a recentre for each halving of the width', () => {
        const lengthFrom = (magnification: number): number => {
            const scope = createScopeModel();
            scope.magnifyAbout(magnification, REST.centreRe, REST.centreIm);
            return timeRecentre(scope);
        };
        const near = lengthFrom(2 ** 10);
        const further = lengthFrom(2 ** 20);
        const furthest = lengthFrom(2 ** 30);

        expect(further).toBeGreaterThan(near);
        expect(Math.abs((furthest - further) - (further - near))).toBeLessThanOrEqual(2);
    });

    it('recentres the same however the time is cut into steps', () => {
        const oneStep = createScopeModel();
        const manySteps = createScopeModel();
        for (const scope of [oneStep, manySteps]) {
            scope.magnifyAbout(50, 0.1, 0.2);
            scope.recentre();
        }

        oneStep.update(MIN_RECENTRE_MS / 2);
        for (let i = 0; i < 10; i++) manySteps.update(MIN_RECENTRE_MS / 20);

        expect(manySteps.width).toBeCloseTo(oneStep.width, 9);
        expect(manySteps.centreRe).toBeCloseTo(oneStep.centreRe, 9);
    });

    it('recentres along the middle when only the centre has moved', async () => {
        const scope = createScopeModel();
        scope.moveCentre(1, 0);
        scope.recentre();
        scope.update(MIN_RECENTRE_MS / 2);

        expect(scope.centreRe).toBeCloseTo(REST.centreRe + 0.5);
        expect(scope.width).toBe(REST.width);
    });

    it('lets any other move stop a recentre where it has got to', () => {
        const moves = [
            (scope: ScopeModel) => { scope.moveCentre(0.01, 0); },
            (scope: ScopeModel) => { scope.magnifyAbout(1.1, scope.centreRe, scope.centreIm); },
            (scope: ScopeModel) => { scope.travelRe = 1; },
            (scope: ScopeModel) => { scope.zooming = 'in'; },
        ];
        for (const move of moves) {
            const scope = createScopeModel();
            scope.magnifyAbout(16, 0, 0);
            scope.recentre();
            scope.update(MIN_RECENTRE_MS / 4);
            move(scope);
            scope.update(1);
            scope.travelRe = 0;
            scope.zooming = 'none';
            const magnification = scope.magnification;
            scope.update(MAX_RECENTRE_MS);

            expect(scope.magnification).toBe(magnification);
            expect(scope.isMoving).toBe(false);
        }
    });

    it('says it is moving until a recentre is done', async () => {
        const scope = createScopeModel();
        scope.magnifyAbout(4, 0, 0);
        scope.recentre();
        expect(scope.isMoving).toBe(true);

        await advanceTime(MAX_RECENTRE_MS, scope);
        expect(scope.isMoving).toBe(false);
    });

    it('jumps to a new fractal at once, abandoning a recentre', () => {
        const scope = createScopeModel();
        scope.magnifyAbout(16, 0, 0);
        scope.recentre();
        scope.chooseFractal('phoenix');

        expect(scope.magnification).toBe(1);
        expect(scope.isMoving).toBe(false);
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

    it('travels across the plane while a control is held, at a rate set by how wide it looks', async () => {
        const scope = createScopeModel();
        scope.travelRe = 1;
        scope.travelIm = -1;
        await advanceTime(100, scope);

        expect(scope.centreRe).toBeCloseTo(REST.centreRe + TRAVEL_RATE * REST.width * 0.1);
        expect(scope.centreIm).toBeCloseTo(REST.centreIm - TRAVEL_RATE * REST.width * 0.1);

        const closeIn = createScopeModel();
        closeIn.magnifyAbout(10, REST.centreRe, REST.centreIm);
        closeIn.travelRe = 1;
        await advanceTime(100, closeIn);

        expect(closeIn.centreRe - REST.centreRe).toBeCloseTo(TRAVEL_RATE * REST.width * 0.1 / 10);
    });

    it('zooms about its centre while a control is held, and back out again', async () => {
        const scope = createScopeModel();
        scope.zooming = 'in';
        await advanceTime(500, scope);

        expect(scope.magnification).toBeCloseTo(Math.exp(ZOOM_RATE * 0.5));
        expect(scope.centreRe).toBeCloseTo(REST.centreRe);

        scope.zooming = 'out';
        await advanceTime(500, scope);

        expect(scope.magnification).toBeCloseTo(1);
    });

    it('zooms the same however the time is cut into steps', () => {
        const oneStep = createScopeModel();
        const manySteps = createScopeModel();
        oneStep.zooming = 'in';
        manySteps.zooming = 'in';

        oneStep.update(100);
        for (let i = 0; i < 10; i++) manySteps.update(10);

        expect(manySteps.magnification).toBeCloseTo(oneStep.magnification);
    });

    it('says whether a held control is moving it', () => {
        const scope = createScopeModel();
        expect(scope.isMoving).toBe(false);

        scope.travelIm = -1;
        expect(scope.isMoving).toBe(true);
        scope.travelIm = 0;
        expect(scope.isMoving).toBe(false);

        scope.zooming = 'out';
        expect(scope.isMoving).toBe(true);
    });

    it('stays put with no control held', async () => {
        const scope = createScopeModel();
        await advanceTime(500, scope);

        expect(scope.centreRe).toBe(REST.centreRe);
        expect(scope.width).toBe(REST.width);
    });

    it('holds its travel to one way or the other, flat out', () => {
        const scope = createScopeModel();
        scope.travelRe = 5;
        scope.travelIm = -5;

        expect(scope.travelRe).toBe(1);
        expect(scope.travelIm).toBe(-1);
    });

    it('stops travelling at the limit of its drift', async () => {
        const scope = createScopeModel();
        scope.travelRe = 1;
        await advanceTime(10000, scope);

        expect(scope.centreRe).toBeCloseTo(REST.centreRe + MAX_CENTRE_DRIFT);
    });
});

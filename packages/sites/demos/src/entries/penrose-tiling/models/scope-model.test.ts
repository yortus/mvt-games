import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/html';
import {
    DEFAULT_RADIUS,
    MAX_RADIUS,
    MIN_RADIUS,
    RESET_MS,
} from '../data';
import { createScopeModel, type ScopeModel } from './scope-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createScopeModel', () => {
    it('keeps its settings within their ranges', () => {
        const scope = createScopeModel();
        scope.radius = 1000;
        expect(scope.radius).toBe(MAX_RADIUS);
        scope.radius = 0;
        expect(scope.radius).toBe(MIN_RADIUS);
        scope.rotation = Math.PI * 3;
        expect(scope.rotation).toBeCloseTo(-Math.PI, 9);
    });

    it('keeps the point it zooms about where it is in the window', () => {
        const scope = createScopeModel();
        const before = toWindow(scope, 4, -3);
        scope.zoomAbout(2, 4, -3);
        expect(scope.radius).toBeCloseTo(DEFAULT_RADIUS / 2, 9);
        const after = toWindow(scope, 4, -3);
        expect(after[0]).toBeCloseTo(before[0], 9);
        expect(after[1]).toBeCloseTo(before[1], 9);
    });

    it('stops zooming at its limits, keeping the point where it is', () => {
        const scope = createScopeModel();
        const before = toWindow(scope, 2, 5);
        scope.zoomAbout(1000, 2, 5);
        expect(scope.radius).toBe(MIN_RADIUS);
        const after = toWindow(scope, 2, 5);
        expect(after[0]).toBeCloseTo(before[0], 9);
        expect(after[1]).toBeCloseTo(before[1], 9);
    });

    it('keeps the point it turns about where it is in the window', () => {
        const scope = createScopeModel();
        scope.moveCentre(1, 2);
        const before = toWindow(scope, -3, 4);
        scope.turnAbout(0.7, -3, 4);
        expect(scope.rotation).toBeCloseTo(0.7, 9);
        const after = toWindow(scope, -3, 4);
        expect(after[0]).toBeCloseTo(before[0], 9);
        expect(after[1]).toBeCloseTo(before[1], 9);
    });

    describe('while a control is held', () => {
        it('travels the way the window faces', async () => {
            // With the view turned a quarter clockwise, the window's right points up what's under it
            const scope = createScopeModel();
            scope.rotation = Math.PI / 2;
            scope.travelX = 1;
            await advanceTime(500, scope);
            expect(Math.abs(scope.centreX)).toBeLessThan(1e-9);
            expect(scope.centreY).toBeLessThan(0);
        });

        it('zooms in about the centre', async () => {
            const scope = createScopeModel();
            scope.moveCentre(5, 5);
            scope.zooming = 'in';
            await advanceTime(500, scope);
            expect(scope.radius).toBeLessThan(DEFAULT_RADIUS);
            expect(scope.centreX).toBeCloseTo(5, 9);
            expect(scope.centreY).toBeCloseTo(5, 9);
        });

        it('turns clockwise', async () => {
            const scope = createScopeModel();
            scope.turning = 'clockwise';
            await advanceTime(500, scope);
            expect(scope.rotation).toBeGreaterThan(0);
        });
    });

    describe('resetting', () => {
        it('stays put until time moves on, so nothing snaps', () => {
            const scope = createStrayedScope();
            scope.reset();
            expect(scope.centreX).toBe(STRAYED_X);
            expect(scope.radius).toBe(STRAYED_RADIUS);
        });

        it('sets out gently', () => {
            const scope = createStrayedScope();
            scope.reset();
            scope.update(RESET_MS / 50);
            expect(scope.centreX).toBeLessThan(STRAYED_X);
            expect(scope.centreX).toBeGreaterThan(STRAYED_X * 0.98);
        });

        it('is half way back at half time, zooming evenly', () => {
            const scope = createStrayedScope();
            scope.reset();
            scope.update(RESET_MS / 2);
            expect(scope.centreX).toBeCloseTo(STRAYED_X / 2, 9);
            expect(scope.centreY).toBeCloseTo(STRAYED_Y / 2, 9);
            expect(scope.rotation).toBeCloseTo(STRAYED_ROTATION / 2, 9);
            expect(scope.radius).toBeCloseTo(Math.sqrt(STRAYED_RADIUS * DEFAULT_RADIUS), 9);
        });

        it('arrives exactly, at any step size', () => {
            for (const stepMs of [7, 16, 100]) {
                const scope = createStrayedScope();
                scope.reset();
                for (let ms = 0; ms < RESET_MS + stepMs; ms += stepMs) scope.update(stepMs);
                expect(scope.centreX).toBe(0);
                expect(scope.centreY).toBe(0);
                expect(scope.radius).toBe(DEFAULT_RADIUS);
                expect(scope.rotation).toBe(0);
            }
        });

        it('takes the short way round, never through a half turn', () => {
            const scope = createScopeModel();
            scope.rotation = Math.PI * 0.9;
            scope.reset();
            scope.update(RESET_MS / 4);
            expect(scope.rotation).toBeGreaterThan(0);
            expect(scope.rotation).toBeLessThan(Math.PI * 0.9);
        });

        it('stays where it arrives', async () => {
            const scope = createStrayedScope();
            scope.reset();
            await advanceTime(RESET_MS, scope);
            scope.moveCentre(3, 0);
            await advanceTime(RESET_MS, scope);
            expect(scope.centreX).toBe(3);
        });

        it('stops where it has got to when the window is moved', () => {
            const scope = createStrayedScope();
            scope.reset();
            scope.update(RESET_MS / 2);
            scope.moveCentre(1, 0);
            const { centreX } = scope;
            scope.update(RESET_MS / 4);
            expect(scope.centreX).toBe(centreX);
        });

        it('stops when the zoom or the turn is set', () => {
            const zoomed = createStrayedScope();
            zoomed.reset();
            zoomed.update(RESET_MS / 4);
            zoomed.radius = MAX_RADIUS;
            zoomed.update(RESET_MS / 4);
            expect(zoomed.radius).toBe(MAX_RADIUS);

            const turned = createStrayedScope();
            turned.reset();
            turned.update(RESET_MS / 4);
            turned.rotation = 1;
            turned.update(RESET_MS / 4);
            expect(turned.rotation).toBe(1);
        });

        it('gives way to a control that is held', () => {
            for (const hold of [
                (scope: ScopeModel) => { scope.travelX = 1; },
                (scope: ScopeModel) => { scope.zooming = 'in'; },
                (scope: ScopeModel) => { scope.turning = 'clockwise'; },
            ]) {
                const scope = createStrayedScope();
                scope.reset();
                hold(scope);
                scope.update(RESET_MS);
                expect(scope.centreX === 0 && scope.radius === DEFAULT_RADIUS && scope.rotation === 0).toBe(false);
            }
        });
    });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const STRAYED_X = 60;
const STRAYED_Y = -40;
const STRAYED_RADIUS = 30;
const STRAYED_ROTATION = 1.2;

/** A scope that has been moved, zoomed and turned. */
function createStrayedScope(): ScopeModel {
    const scope = createScopeModel();
    scope.moveCentre(STRAYED_X, STRAYED_Y);
    scope.radius = STRAYED_RADIUS;
    scope.rotation = STRAYED_ROTATION;
    return scope;
}

/** Where the point (`x`, `y`) is in the window, in radii from its centre. */
function toWindow(scope: ScopeModel, x: number, y: number): [number, number] {
    const cos = Math.cos(scope.rotation);
    const sin = Math.sin(scope.rotation);
    const fromX = x - scope.centreX;
    const fromY = y - scope.centreY;
    return [(fromX * cos - fromY * sin) / scope.radius, (fromX * sin + fromY * cos) / scope.radius];
}

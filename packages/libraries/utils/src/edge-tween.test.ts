import { describe, it, expect } from 'vitest';
import { createEdgeTween } from './edge-tween';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createEdgeTween', () => {
    describe('initial state', () => {
        it('starts at restValue when source is false', () => {
            const tween = createEdgeTween({
                getSource: () => false,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });
            expect(tween.value).toBe(0);
        });

        it('starts at restValue when source is already true (no edge yet)', () => {
            const tween = createEdgeTween({
                getSource: () => true,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });
            expect(tween.value).toBe(0);
        });
    });

    describe('rising edge trigger', () => {
        it('snaps to triggerValue on false-to-true edge', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            source = true;
            tween.update(0);
            expect(tween.value).toBe(1);
        });

        it('triggers when source starts true on first update', () => {
            const tween = createEdgeTween({
                getSource: () => true,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            // wasTrue starts false, so first update with true = rising edge
            tween.update(0);
            expect(tween.value).toBe(1);
        });
    });

    describe('tween playback', () => {
        it('tweens from triggerValue to restValue over durationMs', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            source = true;
            tween.update(0);
            expect(tween.value).toBe(1);

            tween.update(100);
            expect(tween.value).toBeCloseTo(0.5, 5);

            tween.update(100);
            expect(tween.value).toBe(0);
        });

        it('clamps at restValue when time exceeds duration', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            source = true;
            tween.update(0);
            tween.update(500);
            expect(tween.value).toBe(0);
        });

        it('continues tweening while source stays true', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            source = true;
            tween.update(0);
            tween.update(100);
            expect(tween.value).toBeCloseTo(0.5, 5);

            // Source still true - tween continues (no re-trigger, no pause)
            tween.update(100);
            expect(tween.value).toBe(0);
        });

        it('continues tweening after source returns to false', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            source = true;
            tween.update(0);
            tween.update(50);
            expect(tween.value).toBeCloseTo(0.75, 5);

            // Source back to false - tween keeps playing
            source = false;
            tween.update(50);
            expect(tween.value).toBeCloseTo(0.5, 5);

            tween.update(100);
            expect(tween.value).toBe(0);
        });
    });

    describe('re-trigger', () => {
        it('restarts from triggerValue on a new rising edge', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            // First trigger, run to completion
            source = true;
            tween.update(0);
            tween.update(250);
            expect(tween.value).toBe(0);

            // Reset and re-trigger
            source = false;
            tween.update(0);
            source = true;
            tween.update(0);
            expect(tween.value).toBe(1);
        });

        it('restarts mid-tween on a new rising edge', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            // Trigger and advance partway
            source = true;
            tween.update(0);
            tween.update(150);
            expect(tween.value).toBeCloseTo(0.25, 5);

            // Re-trigger (false then true)
            source = false;
            tween.update(0);
            source = true;
            tween.update(0);
            expect(tween.value).toBe(1);
        });
    });

    describe('idle behaviour', () => {
        it('does not change value when idle and source stays false', () => {
            const tween = createEdgeTween({
                getSource: () => false,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            tween.update(100);
            tween.update(100);
            expect(tween.value).toBe(0);
        });

        it('stays at restValue after tween completes', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 1,
                restValue: 0,
                durationMs: 200,
            });

            source = true;
            tween.update(0);
            tween.update(200);
            expect(tween.value).toBe(0);

            // Further updates don't change anything
            tween.update(100);
            expect(tween.value).toBe(0);
        });
    });

    describe('custom value ranges', () => {
        it('works with non-0/1 value ranges', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 10,
                restValue: 30,
                durationMs: 100,
            });

            expect(tween.value).toBe(30);

            source = true;
            tween.update(0);
            expect(tween.value).toBe(10);

            tween.update(50);
            expect(tween.value).toBeCloseTo(20, 5);

            tween.update(50);
            expect(tween.value).toBe(30);
        });

        it('works with inverted ranges (triggerValue < restValue)', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 0,
                restValue: 1,
                durationMs: 100,
            });

            expect(tween.value).toBe(1);

            source = true;
            tween.update(0);
            expect(tween.value).toBe(0);

            tween.update(50);
            expect(tween.value).toBeCloseTo(0.5, 5);

            tween.update(50);
            expect(tween.value).toBe(1);
        });
    });

    describe('zero duration', () => {
        it('snaps to restValue immediately on trigger', () => {
            let source = false;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 1,
                restValue: 0,
                durationMs: 0,
            });

            source = true;
            tween.update(0);
            // progress goes from 0 to 1 instantly
            expect(tween.value).toBe(0);
        });
    });

    describe('easing', () => {
        it('applies easing to the tween progress', () => {
            let source = false;
            const square = (t: number): number => t * t;
            const tween = createEdgeTween({
                getSource: () => source,
                triggerValue: 0,
                restValue: 1,
                durationMs: 100,
                easing: square,
            });

            source = true;
            tween.update(0);
            expect(tween.value).toBe(0);

            // At 50% progress, squared easing = 0.25
            tween.update(50);
            expect(tween.value).toBeCloseTo(0.25, 5);

            // At 100% progress, squared easing = 1.0
            tween.update(50);
            expect(tween.value).toBe(1);
        });
    });
});

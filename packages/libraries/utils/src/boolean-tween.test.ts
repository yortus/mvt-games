import { describe, it, expect } from 'vitest';
import { createBooleanTween } from './boolean-tween';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createBooleanTween', () => {
    describe('initial state', () => {
        it('starts at offValue when source is false', () => {
            const tween = createBooleanTween({
                getSource: () => false,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
            });
            expect(tween.value).toBe(0);
        });

        it('starts at onValue when source is true', () => {
            const tween = createBooleanTween({
                getSource: () => true,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
            });
            expect(tween.value).toBe(1);
        });
    });

    describe('off-to-on transition', () => {
        it('tweens from offValue to onValue over onDurationMs', () => {
            let source = false;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
            });

            source = true;
            tween.update(50);
            expect(tween.value).toBeCloseTo(0.5, 5);

            tween.update(50);
            expect(tween.value).toBe(1);
        });

        it('clamps at onValue when time exceeds duration', () => {
            let source = false;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
            });

            source = true;
            tween.update(200);
            expect(tween.value).toBe(1);
        });
    });

    describe('on-to-off transition', () => {
        it('tweens from onValue to offValue over offDurationMs', () => {
            let source = true;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 200,
            });

            source = false;
            tween.update(100);
            expect(tween.value).toBeCloseTo(0.5, 5);

            tween.update(100);
            expect(tween.value).toBe(0);
        });

        it('clamps at offValue when time exceeds duration', () => {
            let source = true;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
            });

            source = false;
            tween.update(200);
            expect(tween.value).toBe(0);
        });
    });

    describe('mid-transition reversal', () => {
        it('reverses smoothly from current position', () => {
            let source = false;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
            });

            // Start going on
            source = true;
            tween.update(50);
            expect(tween.value).toBeCloseTo(0.5, 5);

            // Reverse mid-way
            source = false;
            tween.update(25);
            expect(tween.value).toBeCloseTo(0.25, 5);

            // Continue to off
            tween.update(25);
            expect(tween.value).toBe(0);
        });

        it('handles rapid back-and-forth', () => {
            let source = false;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
            });

            source = true;
            tween.update(30);
            const afterFirst = tween.value;

            source = false;
            tween.update(10);
            const afterReverse = tween.value;

            source = true;
            tween.update(10);
            const afterReReverse = tween.value;

            expect(afterFirst).toBeCloseTo(0.3, 5);
            expect(afterReverse).toBeCloseTo(0.2, 5);
            expect(afterReReverse).toBeCloseTo(0.3, 5);
        });
    });

    describe('custom off/on values', () => {
        it('works with non-0/1 value ranges', () => {
            let source = false;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 10,
                onValue: 30,
                onDurationMs: 100,
                offDurationMs: 100,
            });

            expect(tween.value).toBe(10);

            source = true;
            tween.update(50);
            expect(tween.value).toBeCloseTo(20, 5);

            tween.update(50);
            expect(tween.value).toBe(30);
        });

        it('works with inverted ranges (onValue < offValue)', () => {
            let source = false;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 1,
                onValue: 0,
                onDurationMs: 100,
                offDurationMs: 100,
            });

            expect(tween.value).toBe(1);

            source = true;
            tween.update(50);
            expect(tween.value).toBeCloseTo(0.5, 5);

            tween.update(50);
            expect(tween.value).toBe(0);
        });
    });

    describe('asymmetric durations', () => {
        it('uses onDurationMs for off-to-on and offDurationMs for on-to-off', () => {
            let source = false;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 200,
            });

            // On transition: 50ms = halfway
            source = true;
            tween.update(50);
            expect(tween.value).toBeCloseTo(0.5, 5);
            tween.update(50);
            expect(tween.value).toBe(1);

            // Off transition: 100ms = halfway (200ms duration)
            source = false;
            tween.update(100);
            expect(tween.value).toBeCloseTo(0.5, 5);
            tween.update(100);
            expect(tween.value).toBe(0);
        });
    });

    describe('zero duration', () => {
        it('snaps to onValue immediately with zero onDurationMs', () => {
            let source = false;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 0,
                offDurationMs: 100,
            });

            source = true;
            tween.update(1);
            expect(tween.value).toBe(1);
        });

        it('snaps to offValue immediately with zero offDurationMs', () => {
            let source = true;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 0,
            });

            source = false;
            tween.update(1);
            expect(tween.value).toBe(0);
        });
    });

    describe('no-op when stable', () => {
        it('stays at offValue when source remains false', () => {
            const tween = createBooleanTween({
                getSource: () => false,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
            });

            tween.update(50);
            tween.update(50);
            expect(tween.value).toBe(0);
        });

        it('stays at onValue when source remains true', () => {
            const tween = createBooleanTween({
                getSource: () => true,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
            });

            tween.update(50);
            tween.update(50);
            expect(tween.value).toBe(1);
        });
    });

    describe('easing', () => {
        it('applies onEasing during off-to-on transition', () => {
            let source = false;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
                onEasing: (t) => t * t, // quadratic ease-in
            });

            source = true;
            tween.update(50);
            // progress = 0.5, eased = 0.25
            expect(tween.value).toBeCloseTo(0.25, 5);
        });

        it('applies offEasing during on-to-off transition', () => {
            let source = true;
            const tween = createBooleanTween({
                getSource: () => source,
                offValue: 0,
                onValue: 1,
                onDurationMs: 100,
                offDurationMs: 100,
                offEasing: (t) => t * t, // quadratic ease-in
            });

            source = false;
            tween.update(50);
            // progress = 0.5, offEasing(1 - 0.5) = offEasing(0.5) = 0.25
            // value = onValue + (offValue - onValue) * 0.25 = 1 + (0 - 1) * 0.25 = 0.75
            expect(tween.value).toBeCloseTo(0.75, 5);
        });
    });
});

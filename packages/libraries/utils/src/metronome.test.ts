import { describe, expect, it } from 'vitest';
import { createMetronome, type Metronome } from './metronome';

const TICK_MS = 1000 / 60;
const PERIOD_MS = 200;

describe('createMetronome', () => {
    it('starts stopped, with a period of 0, and does not beat until given a positive one', () => {
        const metronome = createMetronome();
        expect(metronome.periodMs).toBe(0);
        metronome.update(TICK_MS);
        expect(metronome.count).toBe(0);
    });

    it('reads a period of less than 0, or NaN, as 0', () => {
        const metronome = createMetronome();
        metronome.periodMs = -PERIOD_MS;
        expect(metronome.periodMs).toBe(0);
        metronome.periodMs = Number.NaN;
        expect(metronome.periodMs).toBe(0);
        metronome.update(TICK_MS);
        expect(metronome.count).toBe(0);
    });

    it('beats at once as it starts, then once a period', () => {
        const metronome = createMetronome();
        tick(metronome, TICK_MS, PERIOD_MS);
        expect(metronome.count).toBe(1);
        tickFor(metronome, 1000, PERIOD_MS);
        expect(metronome.count).toBe(1 + Math.floor(1000 / PERIOD_MS));
    });

    it('keeps time whatever the length of the ticks', () => {
        const even = createMetronome();
        const ragged = createMetronome();
        tick(even, TICK_MS, PERIOD_MS);
        tick(ragged, TICK_MS, PERIOD_MS);
        tickFor(even, 1000, PERIOD_MS);
        let elapsed = 0;
        for (const step of [3, 41, 7, 120, 1, 66]) {
            for (let i = 0; i < 4 && elapsed < 1000; i++) {
                const delta = Math.min(step, 1000 - elapsed);
                tick(ragged, delta, PERIOD_MS);
                elapsed += delta;
            }
        }
        while (elapsed < 1000) {
            const delta = Math.min(50, 1000 - elapsed);
            tick(ragged, delta, PERIOD_MS);
            elapsed += delta;
        }
        expect(ragged.count).toBe(even.count);
    });

    it('stops at a period of 0, and beats at once when it starts again', () => {
        const metronome = createMetronome();
        tick(metronome, TICK_MS, PERIOD_MS);
        tickFor(metronome, 500, 0);
        const stopped = metronome.count;
        expect(stopped).toBe(1);
        tick(metronome, TICK_MS, PERIOD_MS);
        expect(metronome.count).toBe(stopped + 1);
    });

    it('beats more often at a shorter period', () => {
        const slow = createMetronome();
        const fast = createMetronome();
        tickFor(slow, 1000, PERIOD_MS);
        tickFor(fast, 1000, PERIOD_MS / 4);
        expect(fast.count).toBeGreaterThan(slow.count * 3);
    });

    it('quickens when its period shortens mid-run, timing the next beat from the last one', () => {
        const stepMs = 10;
        const metronome = createMetronome();
        tick(metronome, stepMs, PERIOD_MS);
        // Three quarters of the way to the next beat
        const sinceBeatMs = PERIOD_MS * 3 / 4;
        for (let elapsed = 0; elapsed < sinceBeatMs; elapsed += stepMs) tick(metronome, stepMs, PERIOD_MS);
        expect(metronome.count).toBe(1);
        // At half the period, the next beat is overdue. It comes on the next tick, and the one after comes a new period later.
        const quicker = PERIOD_MS / 2;
        tick(metronome, stepMs, quicker);
        expect(metronome.count).toBe(2);
        const leftoverMs = sinceBeatMs + stepMs - quicker;
        for (let elapsed = leftoverMs; elapsed + stepMs < quicker; elapsed += stepMs) tick(metronome, stepMs, quicker);
        expect(metronome.count).toBe(2);
        tick(metronome, stepMs, quicker);
        expect(metronome.count).toBe(3);
    });

    it('carries on as before after a deltaMs that is not finite', () => {
        const steady = createMetronome();
        const upset = createMetronome();
        tick(steady, TICK_MS, PERIOD_MS);
        tick(upset, TICK_MS, PERIOD_MS);
        tick(upset, Number.NaN, PERIOD_MS);
        tick(upset, Number.POSITIVE_INFINITY, PERIOD_MS);
        tickFor(steady, 1000, PERIOD_MS);
        tickFor(upset, 1000, PERIOD_MS);
        expect(upset.count).toBe(steady.count);
        expect(upset.count).toBeGreaterThan(1);
    });
});

/** Runs one update step, as a view writes it. It sets the period for now, then calls `update`. */
function tick(metronome: Metronome, deltaMs: number, periodMs: number): void {
    metronome.periodMs = periodMs;
    metronome.update(deltaMs);
}

/** Runs update steps of one tick each, at one period, for `ms` in all. */
function tickFor(metronome: Metronome, ms: number, periodMs: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) tick(metronome, TICK_MS, periodMs);
}

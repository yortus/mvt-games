import { describe, expect, it } from 'vitest';
import { LAPS } from '../data';
import { createLapCounterModel, type LapCounterModel } from './lap-counter-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LapCounterModel', () => {
    it('ends the race as the car crosses the line at the end of its last lap, and not before', () => {
        const { counter, driveTo, driveLap } = startRace();
        for (let i = 1; i < LAPS; i++) driveLap();
        expect(counter.isFinished).toBe(false);
        expect(counter.lap).toBe(LAPS);

        driveLap();
        expect(counter.isFinished).toBe(true);
        expect(counter.lap).toBe(LAPS);
        expect(counter.lapTimesMs).toEqual(Array.from({ length: LAPS }, () => LAP_MS));
        // The clock stops at the finish
        driveTo(SAMPLES / 2);
        expect(counter.raceTimeMs).toBe(LAPS * LAP_MS);
    });

    it('doesn\'t count a lap for backing over the line and driving over it again', () => {
        const { counter, driveTo } = startRace();
        driveTo(5);
        driveTo(SAMPLES - 2);
        driveTo(3);
        expect(counter.lapTimesMs).toHaveLength(0);
        expect(counter.lap).toBe(1);
    });

    it('keeps the best lap from race to race', () => {
        const { counter, driveLap } = startRace();
        for (let i = 0; i < LAPS; i++) driveLap();
        counter.startNewRace();
        expect(counter.bestLapMs).toBe(LAP_MS);
        expect(counter.lap).toBe(1);
        expect(counter.lapTimesMs).toHaveLength(0);
        expect(counter.isFinished).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** How many samples the pretend track has. */
const SAMPLES = 100;

/** How long each step a test drives lasts. `driveLap` drives a lap in four of them. */
const STEP_MS = 1000;
const LAP_MS = STEP_MS * 4;

/** A lap counter on a pretend track, with the car on the line, and ways to drive it round. */
function startRace(): { counter: LapCounterModel; driveTo: (sample: number) => void; driveLap: () => void } {
    const counter = createLapCounterModel({ sampleCount: SAMPLES, laps: LAPS });
    let sample = 0;

    /** Drives the car from where it is to `sample`, in one step. */
    function driveTo(next: number): void {
        counter.step(STEP_MS, sample, next);
        sample = next;
    }

    /** Drives once round from the line, by way of the far side, and over the line again. */
    function driveLap(): void {
        driveTo(SAMPLES * 0.25);
        driveTo(SAMPLES * 0.5);
        driveTo(SAMPLES * 0.9);
        driveTo(1);
    }

    return { counter, driveTo, driveLap };
}

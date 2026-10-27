import { describe, expect, it } from 'vitest';
import { createChipClock } from './chip-clock';

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const BLOCK_MS = BLOCK * 1000 / SAMPLE_RATE;

describe('chip clock', () => {
    it('plays from chip time 0 at the sound card\'s rate, at full gain, from the first block', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE });
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(false);
        expect(clock.fromMs).toBe(0);
        expect(clock.msPerSample).toBe(1000 / SAMPLE_RATE);
        expect([clock.gainFrom, clock.gainTo]).toEqual([1, 1]);
        clock.plan(BLOCK);
        expect(clock.fromMs).toBeCloseTo(BLOCK_MS, 9);
        expect(clock.playheadMs).toBeCloseTo(2 * BLOCK_MS, 9);
    });

    it('holds chip time as it pauses, fades out over one block with the voices sounding, then plans silence', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE });
        clock.plan(BLOCK);
        clock.pause();
        expect(clock.isPaused).toBe(true);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(false);
        expect(clock.msPerSample).toBe(0);
        expect([clock.gainFrom, clock.gainTo]).toEqual([1, 0]);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(true);
        expect(clock.playheadMs).toBeCloseTo(BLOCK_MS, 9);
    });

    it('moves on from where it was held as it resumes, fading in over one block', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE });
        clock.plan(BLOCK);
        clock.pause();
        clock.plan(BLOCK);
        clock.plan(BLOCK);
        clock.resume();
        expect(clock.isPaused).toBe(false);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(false);
        expect(clock.fromMs).toBeCloseTo(BLOCK_MS, 9);
        expect([clock.gainFrom, clock.gainTo]).toEqual([0, 1]);
        clock.plan(BLOCK);
        expect([clock.gainFrom, clock.gainTo]).toEqual([1, 1]);
    });

    it('cancels a pause, with no fade, if it resumes before the fade-out plays', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE });
        clock.plan(BLOCK);
        clock.pause();
        clock.resume();
        clock.plan(BLOCK);
        expect([clock.gainFrom, clock.gainTo]).toEqual([1, 1]);
        expect(clock.msPerSample).toBe(1000 / SAMPLE_RATE);
    });

    it('stays paused, with no fade in, if it pauses again before the fade-in plays', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE });
        clock.pause();
        clock.plan(BLOCK);
        clock.plan(BLOCK);
        clock.resume();
        clock.pause();
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(true);
    });

    it('ignores a pause while paused, and a resume while playing', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE });
        clock.resume();
        clock.plan(BLOCK);
        expect([clock.gainFrom, clock.gainTo]).toEqual([1, 1]);
        clock.pause();
        clock.plan(BLOCK);
        clock.pause();
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(true);
    });
});

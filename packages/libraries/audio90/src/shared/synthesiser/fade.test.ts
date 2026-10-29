import { describe, expect, it } from 'vitest';
import { createFade, FADE_FLOOR_DB } from './fade';

const SAMPLE_RATE = 1000;

describe('createFade', () => {
    it('stays at full volume until a fade starts', () => {
        const fade = createFade({ sampleRate: SAMPLE_RATE });
        for (let i = 0; i < 10; i++) expect(fade.step()).toBe(false);
        expect(fade.gain[0]).toBe(1);
    });

    it('fades out evenly in decibels to the floor, then says so once and goes back to full volume', () => {
        const fade = createFade({ sampleRate: SAMPLE_RATE });
        fade.start(false, 100);
        const levels: number[] = [];
        let ends = 0;
        for (let i = 0; i < 100; i++) {
            if (fade.step()) ends++;
            levels.push(fade.gain[0]);
        }
        // Half way through, it is half way down in decibels
        expect(20 * Math.log10(levels[49])).toBeCloseTo(FADE_FLOOR_DB / 2, 6);
        expect(ends).toBe(1);
        expect(levels[99]).toBe(1);
        expect(fade.step()).toBe(false);
    });

    it('fades in from the floor to full volume, without saying it ended', () => {
        const fade = createFade({ sampleRate: SAMPLE_RATE });
        fade.start(true, 10);
        expect(20 * Math.log10(fade.gain[0])).toBeCloseTo(FADE_FLOOR_DB, 6);
        let ends = 0;
        for (let i = 0; i < 10; i++) if (fade.step()) ends++;
        expect([fade.gain[0], ends]).toEqual([1, 0]);
    });

    it('goes to full volume at once for a fade-in over no time, or as it resets', () => {
        const fade = createFade({ sampleRate: SAMPLE_RATE });
        fade.start(true, 0);
        expect(fade.gain[0]).toBe(1);
        fade.start(false, 50);
        fade.step();
        fade.reset();
        expect([fade.gain[0], fade.step()]).toEqual([1, false]);
    });
});

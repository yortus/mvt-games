import { describe, expect, it } from 'vitest';
import { createAudio80Song, createAudio80Sound } from '../audio80';
import { createHeadlessAudio80 } from './headless-audio80';
import { hashSamples, measurePeak, render } from './render';
import { createRenderingAudio80, type RenderingAudio80 } from './rendering-audio80';

// What every headless chip does, tested on the Audio80. The two chips' own tests cover what each does alone.

const TICK_MS = 16;
/** One tick's samples at the default 48 kHz. */
const TICK_FRAMES = 768;

describe('a headless chip\'s songs', () => {
    it('play as `render` plays them, tick by tick', () => {
        const chip = createRenderingAudio80();
        chip.play(SONG);
        const samples = renderTicks(chip, 40);
        expect(measurePeak(samples)).toBeGreaterThan(0.05);
        expect(hashSamples(samples)).toBe(hashSamples(render(SONG, { tickMs: TICK_MS, durationMs: 40 * TICK_MS })));
    });

    it('answer with the song asked for at once, and from its start', () => {
        const chip = createHeadlessAudio80();
        chip.play(SONG);
        for (let i = 0; i < 20; i++) chip.update(TICK_MS);
        expect(chip.row).toBeGreaterThan(0);
        chip.play(OTHER_SONG);
        expect([chip.song, chip.orderIndex, chip.row, chip.beat]).toEqual([OTHER_SONG, 0, 0, 0]);
        chip.stop();
        expect(chip.song).toBeUndefined();
    });

    it('start at a tempo scale set just after the song, as at one set before it', () => {
        const after = createRenderingAudio80();
        after.play(SONG);
        after.tempoScale = 2;
        const before = createRenderingAudio80();
        before.tempoScale = 2;
        before.play(SONG);
        expect(hashSamples(renderTicks(after, 20))).toBe(hashSamples(renderTicks(before, 20)));
    });

    it('stand still while the chip is paused', () => {
        const chip = createHeadlessAudio80();
        chip.play(SONG);
        chip.update(TICK_MS);
        chip.pause();
        const beat = chip.beat;
        for (let i = 0; i < 20; i++) chip.update(TICK_MS);
        expect([chip.row, chip.beat]).toEqual([0, beat]);
        chip.resume();
        for (let i = 0; i < 20; i++) chip.update(TICK_MS);
        expect(chip.row).toBeGreaterThan(0);
    });
});

describe('a headless chip\'s stop', () => {
    it('releases the song\'s notes and every sound, with no id', () => {
        const chip = createRenderingAudio80();
        chip.play(SONG);
        chip.play(ZAP, { lengthMs: Infinity });
        renderTicks(chip, 2);
        chip.stop();
        expect(chip.song).toBeUndefined();
        // A second on, every release has died away
        expect(measurePeak(renderTicks(chip, 60).subarray(-TICK_FRAMES))).toBeLessThan(1e-6);
    });

    it('stops the song, and leaves the sounds playing, with the song\'s id', () => {
        const chip = createRenderingAudio80();
        const song = chip.play(SONG);
        const zap = chip.play(ZAP, { lengthMs: Infinity });
        renderTicks(chip, 2);
        chip.stop(song);
        expect([chip.song, zap === song]).toEqual([undefined, false]);
        expect(measurePeak(renderTicks(chip, 60).subarray(-TICK_FRAMES))).toBeGreaterThan(0.01);
    });

    it('cuts every voice at once while the chip is paused, so nothing plays on as it resumes', () => {
        const chip = createRenderingAudio80();
        chip.play(ZAP, { lengthMs: Infinity });
        renderTicks(chip, 1);
        chip.pause();
        chip.stop();
        chip.resume();
        expect(measurePeak(renderTicks(chip, 1))).toBe(0);
    });

    it('lets each voice fade out as its envelope says while the chip plays', () => {
        const chip = createRenderingAudio80();
        chip.play(ZAP, { lengthMs: Infinity });
        renderTicks(chip, 1);
        chip.stop();
        expect(measurePeak(renderTicks(chip, 1))).toBeGreaterThan(0.01);
    });
});

describe('a headless chip', () => {
    it('clamps its volume as every chip does', () => {
        const chip = createHeadlessAudio80();
        chip.volume = 3;
        const high = chip.volume;
        chip.volume = -1;
        expect([high, chip.volume]).toEqual([1, 0]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ticks the chip `ticks` times, as a game loop does, rendering each tick's samples, and returns them. */
function renderTicks(chip: RenderingAudio80, ticks: number): Float32Array {
    const samples = new Float32Array(ticks * TICK_FRAMES);
    for (let i = 0; i < ticks; i++) {
        chip.update(TICK_MS);
        chip.renderInto(samples.subarray(i * TICK_FRAMES, (i + 1) * TICK_FRAMES));
    }
    return samples;
}

const SONG = createAudio80Song({
    bpm: 120,
    instruments: { s: createAudio80Sound({ wave: 'saw' }) },
    patterns: { a: '| C-4 s\n| E-4 s\n| G-4 s\n| C-5 s', b: '| D-4 s\n| F-4 s' },
    order: ['a', 'b'],
    loop: 0,
});
const OTHER_SONG = createAudio80Song({ bpm: 90, instruments: { s: createAudio80Sound({ wave: 'pulse' }) }, patterns: { a: '| A-3 s' }, order: ['a'] });
/** A sound with a slow release, so a release is still heard a tick later, and a cut is not. */
const ZAP = createAudio80Sound({ wave: 'saw', note: 'A-4', envelope: { attackMs: 2, decayMs: 0, sustain: 1, releaseMs: 500 } });

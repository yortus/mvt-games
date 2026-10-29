import { describe, expect, it } from 'vitest';
import { type Audio90SoundOptions, createAudio90Song, createAudio90Sound } from '../../audio90';
import { hashSamples, measurePeak, type StereoSamples } from '../rendered-samples';
import { createRenderingAudio90, type RenderingAudio90 } from './rendering-audio90';

/** An envelope that holds its note at full level, and stops quickly once released. */
const HELD_ENVELOPE = { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 };

/** A tenth of a second at the default 48 kHz. */
const FRAMES = 4800;
const SAW: Audio90SoundOptions = { oscillator: { wave: 'saw' }, envelope: HELD_ENVELOPE };
const HELD = createAudio90Sound(SAW);

describe('rendering Audio90', () => {
    it('renders what it is told to play into both channels, and nothing before', () => {
        const chip = createRenderingAudio90();
        expect(measurePeak(renderFrames(chip))).toBe(0);
        const { left, right } = playHeld(chip);
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(measurePeak(right)).toBeGreaterThan(0.05);
    });

    it('pans a sound to the side it is played on', () => {
        const chip = createRenderingAudio90();
        chip.play(HELD, { pan: 1, lengthMs: 50 });
        const { left, right } = renderFrames(chip);
        expect(measurePeak(right)).toBeGreaterThan(0.05);
        expect(measurePeak(left)).toBeLessThan(1e-6);
    });

    it('narrows its mix by its stereo width, gliding there rather than jumping, and keeps the width as it stops', () => {
        const chip = createRenderingAudio90();
        chip.stereoWidth = 0;
        chip.stop();
        expect(chip.stereoWidth).toBe(0);
        chip.play(HELD, { pan: 1, lengthMs: Infinity });
        // It glides from the width it had, 1, so the first samples are still mostly on the right
        const gliding = renderFrames(chip);
        expect(Math.abs(gliding.left[1])).toBeLessThan(Math.abs(gliding.right[1]));
        // By the third tenth of a second it has settled at 0, so a sound panned hard right plays the same on both sides
        renderFrames(chip);
        const { left, right } = renderFrames(chip);
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(left).toEqual(right);
        chip.stereoWidth = 2;
        expect(chip.stereoWidth).toBe(1);
    });

    it('fades a song out as it is stopped with a fade, ends in silence, and plays at full volume after', () => {
        const chip = createRenderingAudio90();
        const song = createAudio90Song({ bpm: 120, instruments: { s: HELD }, patterns: { p: '| C-4 s' }, order: ['p'], loop: 0 });
        const id = chip.play(song);
        const full = renderMs(chip, 100);
        chip.stop(id, { fadeMs: 200 });
        const { left } = renderMs(chip, 200);
        // Evenly in decibels to 60 dB down: the last tenth of the fade is far quieter than the first
        const tenth = left.length / 10;
        expect(measurePeak(left.subarray(0, tenth))).toBeGreaterThan(measurePeak(full) * 0.5);
        expect(measurePeak(left.subarray(9 * tenth))).toBeLessThan(measurePeak(left.subarray(0, tenth)) / 100);
        expect(measurePeak(renderMs(chip, 100))).toBe(0);
        expect(chip.song).toBeUndefined();
        chip.play(HELD, { lengthMs: Infinity });
        expect(measurePeak(renderMs(chip, 50))).toBeCloseTo(measurePeak(full), 1);
    });

    it('fades a song in from silence when its play says so', () => {
        const chip = createRenderingAudio90();
        const song = createAudio90Song({ bpm: 120, instruments: { s: HELD }, patterns: { p: '| C-4 s' }, order: ['p'], loop: 0 });
        chip.play(song, { fadeMs: 200 });
        const { left } = renderMs(chip, 300);
        const tenth = 4800;
        expect(measurePeak(left.subarray(0, tenth / 2))).toBeLessThan(measurePeak(left.subarray(left.length - tenth)) / 100);
    });

    it('renders nothing when muted, and at its volume, which it keeps as everything is stopped while paused', () => {
        const muted = createRenderingAudio90();
        muted.isMuted = true;
        expect(measurePeak(playHeld(muted))).toBe(0);

        const quiet = createRenderingAudio90();
        quiet.volume = 0.5;
        quiet.pause();
        quiet.stop();
        quiet.resume();
        const full = createRenderingAudio90();
        expect(measurePeak(playHeld(quiet))).toBeCloseTo(measurePeak(playHeld(full)) * 0.5, 2);
    });

    it('renders at the sample rate it is given, in the character it is given', () => {
        const studio = createRenderingAudio90({ sampleRate: 32000 });
        const consoleChip = createRenderingAudio90({ sampleRate: 32000, character: 'console' });
        expect(studio.sampleRate).toBe(32000);
        const fm = createAudio90Sound({ engine: 'fm', operators: [{ ratio: 1 }], envelope: HELD_ENVELOPE });
        studio.play(fm, { lengthMs: Infinity });
        consoleChip.play(fm, { lengthMs: Infinity });
        expect(hashSamples(renderFrames(studio))).not.toBe(hashSamples(renderFrames(consoleChip)));
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Plays a held saw and renders `FRAMES` samples of it. */
function playHeld(chip: RenderingAudio90): StereoSamples {
    chip.play(HELD, { note: 'A-3', lengthMs: Infinity });
    return renderFrames(chip);
}

/** Moves the chip's clock on by `ms`, a tick at a time, and renders the samples that time covers, at the default 48 kHz. */
function renderMs(chip: RenderingAudio90, ms: number): StereoSamples {
    const tickMs = 10;
    const tickFrames = 480;
    const left = new Float32Array(ms / tickMs * tickFrames);
    const right = new Float32Array(left.length);
    for (let at = 0; at < left.length; at += tickFrames) {
        chip.update(tickMs);
        chip.renderInto(left.subarray(at, at + tickFrames), right.subarray(at, at + tickFrames));
    }
    return { left, right };
}

/** Renders the chip's next `FRAMES` samples into new buffers. */
function renderFrames(chip: RenderingAudio90): StereoSamples {
    const left = new Float32Array(FRAMES);
    const right = new Float32Array(FRAMES);
    chip.renderInto(left, right);
    return { left, right };
}

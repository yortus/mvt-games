import { describe, expect, it } from 'vitest';
import { type Audio90SoundOptions, createAudio90Sound } from '../audio90';
import { hashSamples } from './hash-samples';
import { measurePeak } from './measure-peak';
import { createRenderingAudio90, type RenderingAudio90 } from './rendering-audio90';
import type { StereoSamples } from './stereo-samples';

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

/** Renders the chip's next `FRAMES` samples into new buffers. */
function renderFrames(chip: RenderingAudio90): StereoSamples {
    const left = new Float32Array(FRAMES);
    const right = new Float32Array(FRAMES);
    chip.renderInto(left, right);
    return { left, right };
}

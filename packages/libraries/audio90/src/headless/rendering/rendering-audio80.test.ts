import { describe, expect, it } from 'vitest';
import { type Audio80FilterMode, type Audio80SoundOptions, createAudio80Song, createAudio80Sound } from '../../audio80';
import { DEFAULT_SAMPLE_RATE } from '../headless-chip';
import { measurePeak } from '../rendered-samples';
import { createRenderingAudio80, type RenderingAudio80 } from './rendering-audio80';

const VOLUME = 0.5;
/** A tenth of a second at the default 48 kHz. */
const FRAMES = 4800;
const SAW: Audio80SoundOptions = { wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } };
const HELD = createAudio80Sound(SAW);

describe('rendering Audio80', () => {
    it('fades a song out as it is stopped with a fade, and ends in silence', () => {
        const chip = createRenderingAudio80();
        const id = chip.play(createAudio80Song({ bpm: 120, instruments: { s: HELD }, patterns: { p: '| C-4 s' }, order: ['p'], loop: 0 }));
        const full = renderMs(chip, 100);
        chip.stop(id, { fadeMs: 200 });
        const fading = renderMs(chip, 200);
        const tenth = fading.length / 10;
        expect(measurePeak(fading.subarray(0, tenth))).toBeGreaterThan(measurePeak(full) * 0.5);
        expect(measurePeak(fading.subarray(9 * tenth))).toBeLessThan(measurePeak(fading.subarray(0, tenth)) / 100);
        expect(measurePeak(renderMs(chip, 100))).toBe(0);
    });

    it('renders at 48 kHz unless told otherwise', () => {
        expect(createRenderingAudio80().sampleRate).toBe(DEFAULT_SAMPLE_RATE);
        expect(createRenderingAudio80({ sampleRate: 22050 }).sampleRate).toBe(22050);
    });

    it('renders what it is told to play, and nothing before', () => {
        const chip = createRenderingAudio80();
        expect(measurePeak(renderFrames(chip))).toBe(0);
        expect(measurePeak(playHeld(chip))).toBeGreaterThan(0);
    });

    it('writes every sample of the buffer it is given, so a buffer can be reused', () => {
        const chip = createRenderingAudio80();
        const samples = new Float32Array(FRAMES).fill(1);
        chip.renderInto(samples);
        expect(measurePeak(samples)).toBe(0);
    });

    it('renders at its volume, and keeps it as everything is stopped while paused, which cuts the voices', () => {
        const quieter = createRenderingAudio80();
        quieter.volume = VOLUME;
        quieter.pause();
        quieter.stop();
        quieter.resume();
        const asWritten = createRenderingAudio80();
        expect(measurePeak(playHeld(quieter)) / measurePeak(playHeld(asWritten))).toBeCloseTo(VOLUME, 1);
    });

    it('renders nothing when muted', () => {
        const chip = createRenderingAudio80();
        chip.isMuted = true;
        expect(measurePeak(playHeld(chip))).toBe(0);
    });

    it('filters with a song\'s filter mode, so a low pass cuts a high note above a low cutoff and a high pass keeps it', () => {
        const lowPassed = renderFilteredNote('lowpass');
        const highPassed = renderFilteredNote('highpass');
        expect(measurePeak(lowPassed)).toBeLessThan(measurePeak(highPassed) / 10);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Plays a held saw and renders `FRAMES` samples of it. */
function playHeld(chip: RenderingAudio80): Float32Array {
    chip.play(HELD, { note: 'A-3', lengthMs: Infinity });
    return renderFrames(chip);
}

/** Renders the chip's next `FRAMES` samples into a new buffer. */
/** Moves the chip's clock on by `ms`, a tick at a time, and renders the samples that time covers, at the default 48 kHz. */
function renderMs(chip: RenderingAudio80, ms: number): Float32Array {
    const tickMs = 10;
    const tickFrames = 480;
    const output = new Float32Array(ms / tickMs * tickFrames);
    for (let at = 0; at < output.length; at += tickFrames) {
        chip.update(tickMs);
        chip.renderInto(output.subarray(at, at + tickFrames));
    }
    return output;
}

function renderFrames(chip: RenderingAudio80): Float32Array {
    const samples = new Float32Array(FRAMES);
    chip.renderInto(samples);
    return samples;
}

/** Renders a song's high saw through filter `a`, whose mode is `mode` and whose cutoff is at the bottom of its range. */
function renderFilteredNote(mode: Audio80FilterMode): Float32Array {
    const chip = createRenderingAudio80({ character: 'clean' });
    const saw = createAudio80Sound({ ...SAW, filter: 'a' });
    chip.play(createAudio80Song({ bpm: 120, instruments: { s: saw }, patterns: { p: '| C-7 s' }, order: ['p'], filters: { a: { mode, cutoffHz: 20 } } }));
    return renderFrames(chip);
}

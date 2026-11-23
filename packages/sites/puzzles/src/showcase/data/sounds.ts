import { createAudio90Sound } from 'audio90';

// ---------------------------------------------------------------------------
// Sounds
// ---------------------------------------------------------------------------

/**
 * A page turning: a soft rush of noise that swells and fades, through a
 * filter that opens and closes again, like a sheet of paper swept over the
 * one under it. It's quiet, since reading the paper is.
 */
export const PAGE_TURNED = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 1400, resonance: 0.2 },
    modEnvelope: { to: 'cutoff', amount: 1.6, envelope: { attackMs: 160, decayMs: 260, sustain: 0, releaseMs: 100 } },
    envelope: { attackMs: 120, decayMs: 280, sustain: 0, releaseMs: 120 },
    lengthMs: 420,
    priority: 1,
    volume: 1.2,
    reverb: 0.15,
});

/**
 * A pencil mark in the margin: a short, dry scratch of bright noise, quieter
 * still than a page, as a pencil drawn quickly across newsprint.
 */
export const PENCIL_MARKED = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'highpass', cutoffHz: 3200, resonance: 0.1 },
    envelope: { attackMs: 8, decayMs: 120, sustain: 0, releaseMs: 40 },
    lengthMs: 170,
    priority: 1,
    volume: 0.7,
});

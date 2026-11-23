import { createAudio90Sound } from 'audio90';

// ---------------------------------------------------------------------------
// Sounds
// ---------------------------------------------------------------------------

// The meadow's sounds, on the Audio90. The river is two held notes of noise,
// and the birds are high sines, played now and then. Outside is quiet but for
// them, so the river sits a little under the music's level, about -26 LUFS,
// and the birds about -29 LUFS each, measured with measureLoudness.

/** The river's rush: noise through a soft low-pass filter that drifts slowly, like water over stones. Held for as long as the player is outside. */
export const RIVER_RUSH = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 1100 },
    lfo: { shape: 'sine', rateHz: 0.13, cutoff: 0.5, volume: 0.25, isRetriggered: false },
    envelope: { attackMs: 2500, decayMs: 0, sustain: 1, releaseMs: 1500 },
    lengthMs: Infinity,
    priority: 2,
    volume: 1.95,
    pan: -0.25,
    reverb: 0.2,
});

/** The river's babble: a narrow band of noise that leaps about, like water bubbling between stones. Held beside the rush. */
export const RIVER_BABBLE = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 1400, resonance: 0.35 },
    lfo: { shape: 'random', rateHz: 11, cutoff: 0.9, isRetriggered: false },
    envelope: { attackMs: 3500, decayMs: 0, sustain: 1, releaseMs: 1500 },
    lengthMs: Infinity,
    priority: 2,
    volume: 0.96,
    pan: 0.25,
    reverb: 0.25,
});

/** A bird's chirp: a high sine that sweeps up again and again, quickly. */
export const BIRD_CHIRP = createAudio90Sound({
    oscillator: { wave: 'sine' },
    lfo: { shape: 'saw', rateHz: 19, pitch: 3, volume: 0.6 },
    envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 30 },
    note: 'A-6',
    lengthMs: 110,
    maxVoices: 4,
    volume: 0.58,
    reverb: 0.35,
});

/** A bird's trill: a sine that flutters fast between two notes. */
export const BIRD_TRILL = createAudio90Sound({
    oscillator: { wave: 'sine' },
    lfo: { shape: 'square', rateHz: 26, pitch: 2 },
    envelope: { attackMs: 10, decayMs: 0, sustain: 1, releaseMs: 60 },
    note: 'E-7',
    lengthMs: 420,
    maxVoices: 2,
    volume: 0.16,
    reverb: 0.35,
});

/** A bird's call: a whistle that rises, falls and rises, in short notes. */
export const BIRD_CALL = createAudio90Sound({
    oscillator: { wave: 'sine' },
    vibrato: { semitones: 0.4, hz: 14, delayMs: 0 },
    envelope: { attackMs: 8, decayMs: 0, sustain: 1, releaseMs: 50 },
    note: 'D-6',
    stepMs: 90,
    steps: `
        # pitch  volume
        +0       vF
        +7
        v0
        +4       vF
        +9
        v0
        +12      vC
    `,
    lengthMs: 630,
    maxVoices: 2,
    volume: 0.21,
    reverb: 0.4,
});

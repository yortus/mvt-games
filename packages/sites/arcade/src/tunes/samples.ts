import { type Audio90Sound, createAudio90Sound, createAudio90Sample, createAudio90Song } from 'audio90';
import { BOOM, BRASS, HAT, KICK, SNARE, STRINGS } from './instruments';

// The samples. None is recorded: each is a short song that the chip plays
// on its own engines and keeps, which is called bouncing. An entry that
// plays the tunes bounces them as it loads, with `prepareAudio90Samples`.

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------

/** An orchestra hit: a brass chord, a string chord and a crack of noise over a bass drum, kept as one sound. */
export const ORCHESTRA_HIT = createAudio90Sample({
    rate: 32000,
    rootNote: 'C-4',
    lengthMs: 750,
    bounce: createAudio90Song({
        bpm: 120,
        instruments: { B: BRASS, S: createStringStab(), n: createCrack(), k: BOOM },
        patterns: {
            hit: `
                # brass chord                   | strings | crack | drum
                | C-4 B | E-4 B | G-4 B | C-3 B | C-5 S   | n     | k
                | ...   | ...   | ...   | ...   | ...     | ...   | ...
                | ===   | ===   | ===   | ===   | ===     | ...   | ...
            `,
        },
        order: ['hit'],
    }),
});

/**
 * An original two-bar break at a jungle tempo, programmed from the analog
 * drums with ghost notes and a little swing, kept at 26 kHz and 12 bits, and
 * cut into 32 slices, one a sixteenth note, to replay in any order.
 */
export const BREAK = createAudio90Sample({
    rate: 26000,
    bits: 12,
    slices: 32,
    bounce: createAudio90Song({
        bpm: 170,
        swing: 0.08,
        instruments: { k: KICK, s: SNARE, h: HAT },
        patterns: {
            bar: `
                # kick | snare | hat
                | k    |       | h
                |      |       | h v5
                |      |       | h
                |      | s v4  | h v5
                |      | s     | h
                |      |       | h v5
                |      | s v3  | h
                | k    | s v4  | h v6
                |      |       | h
                |      | s v3  | h v5
                | k    |       | h
                |      |       | h v5
                |      | s     | h
                |      |       | h v5
                | k    | s v3  | h
                |      | s v5  | h v6
            `,
            turn: `
                | k    |       | h
                |      |       | h v5
                | k    |       | h
                |      | s v4  | h v5
                |      | s     | h
                |      |       | h v5
                |      | s v3  | h
                |      |       | h v6
                | k    | s v5  | h
                |      | s v3  | h v5
                | k    |       | h
                |      | s v4  | h v5
                |      | s     | h
                |      | s v4  | h v5
                |      | s v6  | h
                |      | s v8  | h v6
            `,
        },
        order: ['bar', 'turn'],
    }),
});

/** A choir's "aah": a buzzy pulse through three band-pass filters, one at each of the vowel's resonances, looping back and forth. */
export const CHOIR = createAudio90Sample({
    rate: 32000,
    rootNote: 'A-3',
    lengthMs: 1200,
    loop: { fromMs: 400, toMs: 1150, isPingPong: true },
    bounce: createAudio90Song({
        bpm: 100,
        instruments: { a: createFormant(700, 1), b: createFormant(1220, 0.6), c: createFormant(2600, 0.3) },
        patterns: { aah: '| A-3 a | A-3 b | A-3 c' },
        order: ['aah'],
    }),
});

/** A string ensemble's held note, as a 16-bit console's sample set had one, looping back and forth. */
export const STRINGS_SAMPLE = createAudio90Sample({
    rate: 32000,
    rootNote: 'C-4',
    lengthMs: 1200,
    loop: { fromMs: 500, toMs: 1150, isPingPong: true },
    bounce: createAudio90Song({
        bpm: 100,
        instruments: { s: STRINGS },
        patterns: { held: '| C-4 s' },
        order: ['held'],
    }),
});

// ---------------------------------------------------------------------------
// The Amiga module's samples
// ---------------------------------------------------------------------------

// An Amiga module's samples were 8-bit, at about 16 kHz, and short: the
// drums whole, and a few cycles of a tone, looped, played back at every
// pitch with no smoothing. Each loop holds a whole number of the tone's
// cycles, so it does not click as it goes round.

/** The module's bass: a saw through a low-pass, twenty cycles of A-2 looped. */
export const MOD_BASS_SAMPLE = createAudio90Sample({
    rate: 16574,
    bits: 8,
    rootNote: 'A-2',
    lengthMs: 300,
    loop: { fromMs: 100, toMs: 100 + 20000 / 110 },
    bounce: createToneSong(createModTone('saw', 1600), 'A-2'),
});

/** The module's lead: a pulse, bright and a little hollow, eighty cycles of A-4 looped. */
export const MOD_LEAD_SAMPLE = createAudio90Sample({
    rate: 16574,
    bits: 8,
    rootNote: 'A-4',
    lengthMs: 300,
    loop: { fromMs: 100, toMs: 100 + 80000 / 440 },
    bounce: createToneSong(createModTone('pulse', 5000), 'A-4'),
});

/** The module's drums, each bounced whole. */
export const MOD_KICK_SAMPLE = createAudio90Sample({ rate: 16574, bits: 8, rootNote: 'C-4', lengthMs: 450, bounce: createToneSong(KICK, 'C-2') });
export const MOD_SNARE_SAMPLE = createAudio90Sample({ rate: 16574, bits: 8, rootNote: 'C-4', lengthMs: 250, bounce: createToneSong(SNARE, 'D-4') });
export const MOD_HAT_SAMPLE = createAudio90Sample({ rate: 16574, bits: 8, rootNote: 'C-4', lengthMs: 100, bounce: createToneSong(HAT, 'C-6') });

/** Every sample, for the entry to bounce as it loads. */
export const SAMPLES = [
    ORCHESTRA_HIT, BREAK, CHOIR, STRINGS_SAMPLE, MOD_BASS_SAMPLE, MOD_LEAD_SAMPLE, MOD_KICK_SAMPLE, MOD_SNARE_SAMPLE, MOD_HAT_SAMPLE,
];

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * A song of one note of `instrument`, held for a second: longer than any
 * sample bounced from it, so the note is never released early, which would
 * cut its tail short.
 */
function createToneSong(instrument: Audio90Sound, note: string) {
    return createAudio90Song({ bpm: 15, instruments: { t: instrument }, patterns: { held: `| ${note} t` }, order: ['held'] });
}

/** A tone for an Amiga module's sample: one plain oscillator through a gentle low-pass, held. */
function createModTone(wave: 'saw' | 'pulse', cutoffHz: number): Audio90Sound {
    return createAudio90Sound({
        oscillator: { wave, pulseWidth: 0.3 },
        filter: { mode: 'lowpass12', cutoffHz },
        envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 },
    });
}

/** Strings for the orchestra hit: one voice playing a whole chord, by chord memory. */
function createStringStab(): Audio90Sound {
    return createAudio90Sound({
        oscillator: { wave: 'saw', unison: 4, detune: 0.1, chord: [0, 4, 7, 12] },
        filter: { mode: 'lowpass12', cutoffHz: 3500, resonance: 0.1 },
        envelope: { attackMs: 8, decayMs: 300, sustain: 0.6, releaseMs: 200 },
    });
}

/** The orchestra hit's crack: a burst of high noise. */
function createCrack(): Audio90Sound {
    return createAudio90Sound({
        oscillator: { unison: 0 },
        noise: 1,
        filter: { mode: 'highpass', cutoffHz: 1500, resonance: 0.1 },
        envelope: { attackMs: 0, decayMs: 220, sustain: 0, releaseMs: 100 },
        volume: 0.8,
    });
}

/** One of the choir's resonances: a pulse through a band-pass filter at `hz`, at `level`. */
function createFormant(hz: number, level: number): Audio90Sound {
    return createAudio90Sound({
        oscillator: { wave: 'pulse', pulseWidth: 0.2 },
        filter: { mode: 'bandpass', cutoffHz: hz, resonance: 0.6 },
        envelope: { attackMs: 150, decayMs: 0, sustain: 1, releaseMs: 200 },
        vibrato: { semitones: 0.08, hz: 4.8, delayMs: 200 },
        volume: level,
    });
}

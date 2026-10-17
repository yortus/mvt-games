import {
    type Audio90Instrument,
    type Audio90Song,
    createAudio90Instrument,
    createAudio90Sample,
    createAudio90Song,
    createMusicPlayer,
} from '@mvtjs/chiptune';
import { createHeadlessAudio90 } from '@mvtjs/chiptune/headless';
import { allocationPerFrame, readParams, report, timeFrames } from '../harness/measure';

// Measured file for the `audio90` suite. It times the headless Audio90
// rendering one stereo block of 128 samples, which is how much a browser's
// audio thread asks for at a time, with every voice holding a note and the
// three effects running. It also times a busy song played through the music
// player a tick at a time, as a game loop plays it, and bouncing samples, as
// an entry does while it loads. Every sound here is written for the suite.

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const TICK_MS = 1000 / 60;

const params = readParams();
const measure = String(params.measure);
const engine = String(params.engine);
const voices = Number(params.voices);

// ---- The instruments ------------------------------------------------------

/** A soft electric piano: a bell-like tine over a warm body. */
const KEYS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1 4>3',
    operators: [
        { ratio: 1, envelope: { attackMs: 2, decayMs: 1800, sustain: 0.2, releaseMs: 300 } },
        { ratio: 1, level: 0.3, velocity: 0.8, envelope: { attackMs: 0, decayMs: 900, sustain: 0.1, releaseMs: 200 } },
        { ratio: 1, level: 0.6, detuneCents: 7, envelope: { attackMs: 2, decayMs: 1200, sustain: 0.1, releaseMs: 300 } },
        { ratio: 11, level: 0.12, velocity: 1, envelope: { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 60 } },
    ],
    rateScaling: 0.4,
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 250 },
    volume: 0.5,
    chorus: 0.4,
    reverb: 0.25,
});

/** A hard FM bass, its one modulator feeding back on itself a little. */
const FM_BASS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 500, sustain: 0.5, releaseMs: 60 } },
        { level: 1.6, velocity: 0.6, envelope: { attackMs: 0, decayMs: 180, sustain: 0.2, releaseMs: 60 } },
    ],
    feedback: 0.35,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 50 },
    volume: 0.6,
});

/** Brass, whose modulators swell a little after its carriers. */
const BRASS = createAudio90Instrument({
    engine: 'fm',
    algorithm: '2>1 4>3',
    operators: [
        { envelope: { attackMs: 25, decayMs: 400, sustain: 0.8, releaseMs: 150 } },
        { level: 1.3, envelope: { attackMs: 60, decayMs: 300, sustain: 0.6, releaseMs: 150 } },
        { detuneCents: 9, envelope: { attackMs: 25, decayMs: 400, sustain: 0.8, releaseMs: 150 } },
        { ratio: 2, level: 0.5, envelope: { attackMs: 50, decayMs: 300, sustain: 0.4, releaseMs: 150 } },
    ],
    feedback: 0.2,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    volume: 0.5,
});

/** A trance lead: seven saws, spread wide and detuned, through a filter left open. */
const ANTHEM = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 7, detune: 0.3, spread: 0.8 },
    filter: { cutoffHz: 5000, resonance: 0.1, envelope: { octaves: 0.6, decayMs: 250, releaseMs: 100 } },
    envelope: { attackMs: 5, decayMs: 300, sustain: 0.8, releaseMs: 450 },
    lfo: { rateHz: 5.2, pitch: 0.08 },
    volume: 0.4,
    echo: 0.3,
    reverb: 0.35,
});

/** A wide pad: five slow saws, swelling in, with the chorus around them. */
const PAD = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 5, detune: 0.25, spread: 0.9 },
    filter: { cutoffHz: 1800, resonance: 0.15 },
    envelope: { attackMs: 500, decayMs: 600, sustain: 0.85, releaseMs: 1200 },
    volume: 0.3,
    chorus: 0.3,
    reverb: 0.5,
});

/** A squelching bass: one saw into a resonant filter that snaps shut, with accents and slides. */
const SQUELCH = createAudio90Instrument({
    oscillator: { wave: 'saw' },
    filter: { cutoffHz: 280, resonance: 0.88, drive: 0.4, keyTrack: 0.5, accent: 0.6, envelope: { octaves: 3.2, decayMs: 200, releaseMs: 40 } },
    envelope: { attackMs: 1, decayMs: 0, sustain: 1, releaseMs: 25 },
    legato: { glideMs: 70 },
    volume: 0.6,
    echo: 0.1,
});

/** A bass of two saws drifting against each other, under a filter that wanders. */
const REESE = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 2, detune: 0.12, spread: 0.3 },
    sub: 0.5,
    filter: { cutoffHz: 500, resonance: 0.2 },
    lfo: { rateHz: 0.3, cutoff: 0.6 },
    envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 120 },
    volume: 0.5,
});

/** Strings for the orchestra hit: one voice playing a whole chord, by chord memory. */
const STRING_STAB = createAudio90Instrument({
    oscillator: { wave: 'saw', unison: 4, detune: 0.1, chord: [0, 4, 7, 12] },
    filter: { mode: 'lowpass12', cutoffHz: 3500, resonance: 0.1 },
    envelope: { attackMs: 8, decayMs: 300, sustain: 0.6, releaseMs: 200 },
});

const BOOM = createAudio90Instrument({
    oscillator: { wave: 'sine' },
    modEnvelope: { to: 'pitch', amount: 24, envelope: { attackMs: 0, decayMs: 45, sustain: 0, releaseMs: 0 } },
    envelope: { attackMs: 0, decayMs: 450, sustain: 0, releaseMs: 100 },
    note: 'C-2',
});
const HAT = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 0.8,
    filter: { mode: 'highpass', cutoffHz: 7500, resonance: 0.2 },
    envelope: { attackMs: 0, decayMs: 55, sustain: 0, releaseMs: 30 },
    volume: 0.5,
    pan: 0.3,
    note: 'C-6',
});
const CLAP = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 1300, resonance: 0.5 },
    envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 80 },
    volume: 0.8,
    reverb: 0.3,
});
const CRACK = createAudio90Instrument({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'highpass', cutoffHz: 1500, resonance: 0.1 },
    envelope: { attackMs: 0, decayMs: 220, sustain: 0, releaseMs: 100 },
});

// ---- The samples, and the songs they are bounced from ----------------------------

/** An orchestra hit: a brass chord, a string chord and a crack of noise over the bass drum. */
const HIT_SONG = createAudio90Song({
    bpm: 120,
    instruments: { B: BRASS, S: STRING_STAB, n: CRACK, k: BOOM },
    patterns: {
        hit: `
            | C-4 B | E-4 B | G-4 B | C-3 B | C-5 S | n | k
            | ...   | ...   | ...   | ...   | ...   | ... | ...
            | ===   | ===   | ===   | ===   | ===   | ... | ...
        `,
    },
    order: ['hit'],
});

/** An original two-bar break of analog drums, with ghost notes, at a jungle tempo. */
const BREAK_SONG = createAudio90Song({
    bpm: 170,
    swing: 0.1,
    instruments: { k: BOOM, h: HAT, c: CLAP },
    patterns: {
        bar: `
            | k   | h   | ...
            | ... | h v6| ...
            | ... | h   | c
            | ... | h v6| ...
            | ... | h   | ...
            | k   | h v6| c v4
            | ... | h   | ...
            | ... | h v6| ...
        `,
    },
    order: ['bar', 'bar', 'bar', 'bar'],
});

/** A song as busy as any an entry would bounce: two chords of seven saws and two FM notes, held all the way. */
const BUSY_ROWS = Array.from({ length: 64 }, (_, i) => (i % 4 === 0 ? '| C-3 A c47 | E-3 A c37 | G-4 K | C-5 K' : '| ... | ... | ... | ...')).join('\n');
const BUSY_OPTIONS = { bpm: 120, instruments: { A: ANTHEM, K: KEYS }, patterns: { p: BUSY_ROWS }, order: ['p'] };

// ---- The voices each case plays -------------------------------------------

/** The orchestra hit, looping, so a sample voice plays for as long as it is measured. */
function createHitInstrument(): Audio90Instrument {
    const sample = createAudio90Sample({ bounce: HIT_SONG, rate: 32000, lengthMs: 750, loop: { fromMs: 125, toMs: 720 } });
    return createAudio90Instrument({ engine: 'sample', sample, envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 }, reverb: 0.3 });
}

/** A busy song's voices, in the order they fill: FM keys, a supersaw, an FM bass, a pad, a sample, an acid bass, a reese and FM brass, then again. */
const MIX: readonly Audio90Instrument[] = engine === 'mix' ? [KEYS, ANTHEM, FM_BASS, PAD, createHitInstrument(), SQUELCH, REESE, BRASS] : [];

const ONE_ENGINE: Readonly<Record<string, Audio90Instrument>> = {
    'fm': KEYS,
    'fm-console': KEYS,
    'analog-1': SQUELCH,
    'analog-7': ANTHEM,
    ...(engine === 'sample' ? { sample: createHitInstrument() } : {}),
};

// ---- What each case measures ----------------------------------------------------

if (measure === 'bounce') {
    const sample = String(params.sample);
    const make = (): number => {
        switch (sample) {
            case 'hit':
                return createAudio90Sample({ bounce: HIT_SONG, rate: 32000, lengthMs: 750 }).data.data.length;
            case 'break':
                return createAudio90Sample({ bounce: BREAK_SONG, rate: 26000, bits: 12, slices: 32 }).data.data.length;
            case 'busy':
                return createAudio90Sample({ bounce: createAudio90Song(BUSY_OPTIONS), rate: 32000, lengthMs: 8000 }).data.data.length;
            default:
                return createAudio90Sample({ bounce: createAudio90Song({ ...BUSY_OPTIONS, reverb: { level: 0.3 } }), rate: 32000, lengthMs: 8000 }).data.data.length;
        }
    };
    // Each sample is made afresh, so each bounces. Two to warm up, then the median of seven
    make();
    make();
    const times: number[] = [];
    let length = 0;
    for (let i = 0; i < 7; i++) {
        const start = performance.now();
        length = make();
        times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    report({ msPerBounce: times[3], samples: length });
}
else if (engine === 'song') {
    const chip = createHeadlessAudio90({ render: { sampleRate: SAMPLE_RATE } });
    const player = createMusicPlayer({ audio90: chip.audio90 });
    player.play(createSong());
    const frames = SAMPLE_RATE / 60;
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    // One tick of a game loop: the chip's clock, the view's update and refresh, then the sound up to the new time
    const tick = (): void => {
        chip.controls.update(TICK_MS);
        player.update(TICK_MS);
        player.refresh();
        chip.render(left, right);
    };
    // Two bars first, so every instrument has played and every sample is sent
    for (let i = 0; i < 240; i++) tick();
    const usPerTick = timeFrames(tick);
    report({ usPerTick, bytesPerTick: await allocationPerFrame(tick) });
}
else {
    const chip = createHeadlessAudio90({ render: { sampleRate: SAMPLE_RATE, character: engine === 'fm-console' ? 'console' : 'studio' } });
    for (let v = 0; v < voices; v++) {
        const instrument = engine === 'mix' ? MIX[v % MIX.length] : ONE_ENGINE[engine];
        chip.audio90.noteOn(v, instrument, 48 + (v * 5) % 24, 0.8);
    }
    const left = new Float32Array(BLOCK);
    const right = new Float32Array(BLOCK);
    // A second first, so that the measured blocks play sustained notes, not their attacks
    for (let i = 0; i < SAMPLE_RATE / BLOCK; i++) chip.render(left, right);
    const renderBlock = (): void => {
        chip.render(left, right);
    };
    if (measure === 'allocation') report({ bytesPerBlock: await allocationPerFrame(renderBlock) });
    else report({ usPerBlock: timeFrames(renderBlock) });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * A busy song, of ten channels and every engine: house piano stabs on two
 * channels, a pad, a lead, an FM bass, an acid line, an orchestra hit, and
 * drums, with all three effects and the pump. It loops.
 */
function createSong(): Audio90Song {
    return createAudio90Song({
        bpm: 128,
        instruments: { K: KEYS, P: PAD, A: ANTHEM, B: FM_BASS, Q: SQUELCH, H: createHitInstrument(), k: BOOM, h: HAT, c: CLAP },
        patterns: {
            loop: `
                # keys L | keys R | pad     | lead    | bass  | acid      | hit   | kick | hat | clap
                | C-5 K  | E-5 K  | C-4 P   | G-5 A   | ...   | C-2 Q !   | C-4 H | k    | ... | ...
                | ...    | ...    | ...     | ...     | ...   | C-3 Q     | ...   | ...  | h   | ...
                | ...    | ...    | ...     | ...     | C-2 B | D#2 Q >   | ...   | ...  | ... | ...
                | ===    | ===    | ...     | A-5     | ...   | C-2 Q !   | ===   | ...  | h   | ...
                | A-4 K  | C-5 K  | ...     | ...     | ...   | G-2 Q     | ...   | k    | ... | c
                | ...    | ...    | ...     | ...     | ...   | C-3 Q     | ...   | ...  | h   | ...
                | ...    | ...    | ...     | G-5     | C-2 B | A#2 Q !   | ...   | ...  | ... | ...
                | ===    | ===    | ...     | ...     | ...   | C-2 Q     | ...   | ...  | h   | ...
                | F-4 K  | A-4 K  | F-3 P   | F-5     | ...   | F-2 Q !   | ...   | k    | ... | ...
                | ...    | ...    | ...     | ...     | ...   | F-3 Q     | ...   | ...  | h   | ...
                | ...    | ...    | ...     | ...     | F-1 B | G#2 Q >   | ...   | ...  | ... | ...
                | ===    | ===    | ...     | E-5     | ...   | F-2 Q     | ...   | ...  | h   | ...
                | G-4 K  | B-4 K  | G-3 P   | D-5     | ...   | G-2 Q !   | ...   | k    | ... | c
                | ...    | ...    | ...     | ...     | ...   | G-3 Q     | ...   | ...  | h   | ...
                | ...    | ...    | ...     | ...     | G-1 B | A#2 Q     | ...   | ...  | ... | ...
                | ===    | ===    | ===     | ===     | ...   | G-2 Q !   | ...   | ...  | h   | ...
            `,
        },
        order: ['loop'],
        loop: 0,
        mixer: [{ pan: -0.4, chorus: 0.3 }, { pan: 0.4, chorus: 0.3 }, { reverb: 0.3 }, { reverb: 0.2, echo: 0.2 }],
        reverb: { size: 0.6, decayMs: 1800, level: 0.4 },
        echo: { timeBeats: 3 / 4, feedback: 0.35, isPingPong: true, level: 0.3 },
        chorus: { depth: 0.5, rateHz: 0.6, level: 0.5 },
        pump: { channel: 7, depth: 0.5, releaseMs: 200 },
    });
}

import { createInstrument, createSoundEffect, type SoundEffect } from '@mvtjs/audio';

// Kwazy Cactii's sound effects, for the Audio80. They were all written for
// this game. The game has no music, as suits a casual puzzle game of the
// 2000s. The moves make soft, round sounds on two wavetables, which are the
// tones of a marimba and of glass. Each match plays a burst and a brass
// fanfare, and the fanfare climbs a pentatonic scale with each step of a
// cascade.

// ---------------------------------------------------------------------------
// Wavetables
// ---------------------------------------------------------------------------

/** A marimba's tone: a sine, with a little of its fourth harmonic. */
const MARIMBA_WAVE = '7ACC CBBC EFFE CA87 7875 3100 1344 3335';
/** Glass: a sine, with its third and fifth harmonics. */
const GLASS_WAVE = '8CEF EEDE EEDE EFEC 8310 1121 1121 1013';

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

/** Two cactii swapping places: a soft whoop, rising. */
export const SWAP = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: MARIMBA_WAVE,
        envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 60 },
    }),
    note: 'G-4',
    glideTo: 'D-5',
    lengthMs: 110,
    priority: 1,
    volume: 0.6,
});

/** A swap that makes no line, undone: two low knocks, falling. */
export const SWAP_BACK = createSoundEffect({
    note: 'E-4',
    stepMs: 90,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 70 },
    priority: 1,
    volume: 0.8,
    wave: 'triangle',
    steps: `
        # pitch  vol
        +0       vF
        +0       v0
        -4       vD
    `,
});

/** The cactii dropping into place: a soft wooden tock. */
export const LAND = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: MARIMBA_WAVE,
        envelope: { attackMs: 0, decayMs: 70, sustain: 0, releaseMs: 0 },
    }),
    note: 'C-4',
    lengthMs: 70,
    priority: 0,
    volume: 0.55,
});

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

/** A match going off: a crack of noise, falling away. */
export const MATCH_BURST = createSoundEffect({
    note: 'C-5',
    stepMs: 30,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    priority: 2,
    maxVoices: 2,
    volume: 0.8,
    steps: `
        # wave   pitch  vol
        noise    +24    vF
        noise    +19    vD
        noise    +14    vA
        noise    +10    v7
        noise    +6     v4
    `,
});

/**
 * The brass that plays the match fanfares. It is a saw wave through a filter
 * that opens as each note starts. Each note runs up a major chord, and rings
 * on in the echo.
 */
const BRASS = createInstrument({
    wave: 'saw',
    filter: 'a',
    filterSweep: { fromHz: 500, toHz: 6000, ms: 90 },
    envelope: { attackMs: 8, decayMs: 500, sustain: 0.2, releaseMs: 200 },
    arpeggio: [0, 4, 7, 12],
    stepMs: 45,
    echo: 0.35,
});

/**
 * The fanfares for the steps of a cascade, one note apart on a pentatonic
 * scale. The first match plays the first fanfare, the second match plays the
 * next, and so on. A cascade longer than the list replays the last one.
 */
export const CASCADE_FANFARES: readonly SoundEffect[] = ['C-4', 'D-4', 'E-4', 'G-4', 'A-4', 'C-5', 'D-5', 'E-5'].map((note) =>
    createSoundEffect({ instrument: BRASS, note, lengthMs: 360, priority: 2, maxVoices: 2 }),
);

/** A match that clears five or more cactii: glass, sparkling up two octaves, then up again as it fades. */
export const BIG_MATCH = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: GLASS_WAVE,
        envelope: { attackMs: 0, decayMs: 600, sustain: 0, releaseMs: 200 },
        arpeggio: [0, 4, 7, 12, 16, 19, 24],
        stepMs: 40,
        echo: 0.4,
    }),
    note: 'G-5',
    lengthMs: 500,
    priority: 2,
    volume: 0.5,
});

/** A cascade long enough for fireworks: a whistle rising, then the crackle as they burst. */
export const FIREWORKS = createSoundEffect({
    note: 'C-6',
    stepMs: 50,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 250 },
    echo: 0.45,
    priority: 3,
    volume: 0.5,
    wavetable: GLASS_WAVE,
    steps: `
        # wave      pitch   vol
        wavetable   +0      v5
        wavetable   +3      v6
        wavetable   +6      v7
        wavetable   +9      v8
        wavetable   +12     v8
        wavetable   +14     v7
        noise       +24     vF
        noise       +19     v6
        noise       +24     vC
        noise       +17     v5
        noise       +22     v9
        noise       +19     v3
        noise       +24     v6
    `,
});

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

/** A new board: three notes on the glass, up. */
export const NEW_GAME = createSoundEffect({
    note: 'C-5',
    stepMs: 110,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    echo: 0.35,
    priority: 3,
    volume: 0.5,
    wave: 'wavetable',
    wavetable: GLASS_WAVE,
    steps: `
        # pitch
        +0
        +4
        +7
    `,
});

/** No moves left: three notes on the marimba, down, and a long ring. */
export const GAME_OVER = createSoundEffect({
    note: 'G-4',
    stepMs: 220,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 700 },
    echo: 0.4,
    priority: 3,
    volume: 0.7,
    wave: 'wavetable',
    wavetable: MARIMBA_WAVE,
    steps: `
        # pitch
        +0
        -3
        -7
    `,
});

import { createInstrument, createSoundEffect, type SoundEffect } from '@mvtjs/audio';
import { MIN_CASCADE_FOR_FIREWORKS } from './constants';

// Kwazy Cactii's sound effects, for the Audio80. They were all written for
// this game. The game has no music, as suits a casual puzzle game of the
// 2000s. The moves make soft, round, brief sounds on two wavetables, which
// are the tones of a marimba and of glass. Each match whistles, a note higher
// at each step of a cascade, and the steps that set off fireworks crackle over
// the whistle as they burst, higher at each step.

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

/**
 * Two cactii swapping places: one short blip on the glass. A player hears it
 * on every move, so it is brief and soft, and it does not rise or ring.
 */
export const SWAP = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: GLASS_WAVE,
        envelope: { attackMs: 0, decayMs: 45, sustain: 0, releaseMs: 0 },
    }),
    note: 'D-5',
    lengthMs: 40,
    priority: 1,
    volume: 0.55,
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

/** A match going off: a whistle rising on the glass. */
const WHISTLE_STEPS = `
    # wave      pitch   vol
    wavetable   +0      v5
    wavetable   +3      v6
    wavetable   +6      v7
    wavetable   +9      v8
    wavetable   +12     v8
    wavetable   +14     v7
`;

/**
 * The silence the crackle waits out before it bursts. It is three steps, so
 * the crackle comes in over the whistle it plays beside rather than at the
 * same instant as it.
 */
const CRACKLE_REST_STEPS = `
    # wave      pitch   vol
    noise       +0      v0
    noise       +0      v0
    noise       +0      v0
`;

/** The crackle of the fireworks: the pitch of each step, in semitones above the match's note, and how loud it is. */
const CRACKLE_STEPS: readonly (readonly [number, string])[] = [
    [24, 'vF'], [19, 'v6'], [24, 'vC'], [17, 'v5'], [22, 'v9'], [19, 'v3'], [24, 'v6'],
];

/** How much higher the crackle sits at each step of a cascade past the first one to set off fireworks. */
const CRACKLE_LIFT_PER_STEP = 2;

/**
 * The notes of the cascade, one note apart on a pentatonic scale. The first
 * match plays the first note, the second match plays the next, and so on, so
 * a long cascade climbs. A cascade longer than the list replays the top note.
 */
const CASCADE_NOTES = ['G-5', 'A-5', 'C-6', 'D-6', 'E-6', 'G-6'];

/** The settings every match shares. Only the step table and the volume differ. */
const CASCADE_OPTIONS = {
    stepMs: 50,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 250 },
    echo: 0.45,
    priority: 2,
    maxVoices: 2,
    wavetable: GLASS_WAVE,
} as const;

/** The whistle of a match at each step of a cascade, one note higher at each step. */
export const CASCADE_WHISTLES: readonly SoundEffect[] = CASCADE_NOTES.map((note) =>
    createSoundEffect({ ...CASCADE_OPTIONS, note, steps: WHISTLE_STEPS, volume: 0.9 }),
);

/**
 * The crackle that bursts over the whistle, on the steps of a cascade that set
 * off fireworks, and undefined on the steps before them. It is an effect of
 * its own, so it plays on its own voice beside the whistle and neither cuts
 * the other off. Each step past the first one crackles higher, so a long
 * cascade grows brighter as well as higher.
 *
 * The two lists run in step, so one cascade step reads the same index in
 * either.
 */
export const CASCADE_CRACKLES: readonly (SoundEffect | undefined)[] = CASCADE_NOTES.map((note, index) => {
    const step = index + 1;
    if (step < MIN_CASCADE_FOR_FIREWORKS) return undefined;
    const lift = (step - MIN_CASCADE_FOR_FIREWORKS) * CRACKLE_LIFT_PER_STEP;
    return createSoundEffect({ ...CASCADE_OPTIONS, note, steps: CRACKLE_REST_STEPS + writeCrackleSteps(lift), volume: 0.5 });
});

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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Writes the crackle's step table, every step `lift` semitones up. */
function writeCrackleSteps(lift: number): string {
    let steps = '';
    for (let i = 0; i < CRACKLE_STEPS.length; i++) {
        const [pitch, volume] = CRACKLE_STEPS[i];
        steps += `    noise  +${pitch + lift}  ${volume}\n`;
    }
    return steps;
}

import { createAudio90Song } from '@mvtjs/chiptune';
import { CRASH, FM_BASS, GATED_PAD, KICK, OPEN_HAT, PAD, PLUCK, SNARE, SUPERSAW } from './instruments';
import type { Tune } from './tune';

/** Trance: a breakdown of pad and plucks, a build of gated pad and a snare roll, and the drop with its lead of seven saws. */
export const BREAKDOWN_BUILD_SONG = createAudio90Song({
    bpm: 138,
    volume: 1.58,
    instruments: { L: SUPERSAW, p: PLUCK, D: PAD, g: GATED_PAD, B: FM_BASS, k: KICK, s: SNARE, o: OPEN_HAT, C: CRASH },
    pump: { channel: 5, depth: 0.35, releaseMs: 200 },
    reverb: { size: 0.8, decayMs: 2600, level: 0.4 },
    echo: { timeBeats: 0.75, feedback: 0.4, isPingPong: true, level: 0.35 },
    mixer: [
        {  },
        { pan: -0.3 },
        {  },
        {  },
    ],
    patterns: {
        breakdown: `
            # lead | pluck    | pad       | gated pad | bass | kick | snare | open hat | crash
            |      | D-5 p vC | D-4 D c37 |           |      |      |       |          |
            |      | F-5 p v9 |           |           |      |      |       |          |
            |      | A-5 p v9 |           |           |      |      |       |          |
            |      | D-6 p v9 |           |           |      |      |       |          |
            |      | A-5 p vC |           |           |      |      |       |          |
            |      | F-5 p v9 |           |           |      |      |       |          |
            |      | A-5 p v9 |           |           |      |      |       |          |
            |      | D-6 p v9 |           |           |      |      |       |          |
            |      | D-5 p vC |           |           |      |      |       |          |
            |      | F-5 p v9 |           |           |      |      |       |          |
            |      | A-5 p v9 |           |           |      |      |       |          |
            |      | D-6 p v9 |           |           |      |      |       |          |
            |      | A-5 p vC |           |           |      |      |       |          |
            |      | F-5 p v9 |           |           |      |      |       |          |
            |      | A-5 p v9 |           |           |      |      |       |          |
            |      | D-6 p v9 |           |           |      |      |       |          |
            |      | A#4 p vC | A#3 D c47 |           |      |      |       |          |
            |      | D-5 p v9 |           |           |      |      |       |          |
            |      | F-5 p v9 |           |           |      |      |       |          |
            |      | A#5 p v9 |           |           |      |      |       |          |
            |      | F-5 p vC |           |           |      |      |       |          |
            |      | D-5 p v9 |           |           |      |      |       |          |
            |      | F-5 p v9 |           |           |      |      |       |          |
            |      | A#5 p v9 |           |           |      |      |       |          |
            |      | A#4 p vC |           |           |      |      |       |          |
            |      | D-5 p v9 |           |           |      |      |       |          |
            |      | F-5 p v9 |           |           |      |      |       |          |
            |      | A#5 p v9 |           |           |      |      |       |          |
            |      | F-5 p vC |           |           |      |      |       |          |
            |      | D-5 p v9 |           |           |      |      |       |          |
            |      | F-5 p v9 |           |           |      |      |       |          |
            |      | A#5 p v9 |           |           |      |      |       |          |
            |      | C-5 p vC | C-4 D c47 |           |      |      |       |          |
            |      | E-5 p v9 |           |           |      |      |       |          |
            |      | G-5 p v9 |           |           |      |      |       |          |
            |      | C-6 p v9 |           |           |      |      |       |          |
            |      | G-5 p vC |           |           |      |      |       |          |
            |      | E-5 p v9 |           |           |      |      |       |          |
            |      | G-5 p v9 |           |           |      |      |       |          |
            |      | C-6 p v9 |           |           |      |      |       |          |
            |      | C-5 p vC |           |           |      |      |       |          |
            |      | E-5 p v9 |           |           |      |      |       |          |
            |      | G-5 p v9 |           |           |      |      |       |          |
            |      | C-6 p v9 |           |           |      |      |       |          |
            |      | G-5 p vC |           |           |      |      |       |          |
            |      | E-5 p v9 |           |           |      |      |       |          |
            |      | G-5 p v9 |           |           |      |      |       |          |
            |      | C-6 p v9 |           |           |      |      |       |          |
            |      | A-4 p vC | A-3 D c37 |           |      |      |       |          |
            |      | C-5 p v9 |           |           |      |      |       |          |
            |      | E-5 p v9 |           |           |      |      |       |          |
            |      | A-5 p v9 |           |           |      |      |       |          |
            |      | E-5 p vC |           |           |      |      |       |          |
            |      | C-5 p v9 |           |           |      |      |       |          |
            |      | E-5 p v9 |           |           |      |      |       |          |
            |      | A-5 p v9 |           |           |      |      |       |          |
            |      | A-4 p vC |           |           |      |      |       |          |
            |      | C-5 p v9 |           |           |      |      |       |          |
            |      | E-5 p v9 |           |           |      |      |       |          |
            |      | A-5 p v9 |           |           |      |      |       |          |
            |      | E-5 p vC |           |           |      |      |       |          |
            |      | C-5 p v9 |           |           |      |      |       |          |
            |      | E-5 p v9 |           |           |      |      |       |          |
            |      | A-5 p v9 |           |           |      |      |       |          |
        `,
        build: `
            # lead | pluck    | pad | gated pad    | bass | kick | snare | open hat | crash
            |      | D-5 p vC |     | D-4 g c37 f6 |      |      | s v6  |          |
            |      | F-5 p v9 |     |              |      |      |       |          |
            |      | A-5 p v9 |     |              |      |      |       |          |
            |      | D-6 p v9 |     |              |      |      |       |          |
            |      | A-5 p vC |     |              |      |      | s v6  |          |
            |      | F-5 p v9 |     |              |      |      |       |          |
            |      | A-5 p v9 |     |              |      |      |       |          |
            |      | D-6 p v9 |     |              |      |      |       |          |
            |      | D-5 p vC |     |              |      |      | s v6  |          |
            |      | F-5 p v9 |     |              |      |      |       |          |
            |      | A-5 p v9 |     |              |      |      |       |          |
            |      | D-6 p v9 |     |              |      |      |       |          |
            |      | A-5 p vC |     |              |      |      | s v6  |          |
            |      | F-5 p v9 |     |              |      |      |       |          |
            |      | A-5 p v9 |     |              |      |      |       |          |
            |      | D-6 p v9 |     |              |      |      |       |          |
            |      | A#4 p vC |     | A#3 g c47 f9 |      |      | s v8  |          |
            |      | D-5 p v9 |     |              |      |      |       |          |
            |      | F-5 p v9 |     |              |      |      | s v8  |          |
            |      | A#5 p v9 |     |              |      |      |       |          |
            |      | F-5 p vC |     |              |      |      | s v8  |          |
            |      | D-5 p v9 |     |              |      |      |       |          |
            |      | F-5 p v9 |     |              |      |      | s v8  |          |
            |      | A#5 p v9 |     |              |      |      |       |          |
            |      | A#4 p vC |     |              |      |      | s v8  |          |
            |      | D-5 p v9 |     |              |      |      |       |          |
            |      | F-5 p v9 |     |              |      |      | s v8  |          |
            |      | A#5 p v9 |     |              |      |      |       |          |
            |      | F-5 p vC |     |              |      |      | s v8  |          |
            |      | D-5 p v9 |     |              |      |      |       |          |
            |      | F-5 p v9 |     |              |      |      | s v8  |          |
            |      | A#5 p v9 |     |              |      |      |       |          |
            |      | C-5 p vC |     | C-4 g c47 fC |      |      | s vA  |          |
            |      | E-5 p v9 |     |              |      |      | s vA  |          |
            |      | G-5 p v9 |     |              |      |      | s vA  |          |
            |      | C-6 p v9 |     |              |      |      | s vA  |          |
            |      | G-5 p vC |     |              |      |      | s vA  |          |
            |      | E-5 p v9 |     |              |      |      | s vA  |          |
            |      | G-5 p v9 |     |              |      |      | s vA  |          |
            |      | C-6 p v9 |     |              |      |      | s vA  |          |
            |      | C-5 p vC |     |              |      |      | s vA  |          |
            |      | E-5 p v9 |     |              |      |      | s vA  |          |
            |      | G-5 p v9 |     |              |      |      | s vA  |          |
            |      | C-6 p v9 |     |              |      |      | s vA  |          |
            |      | G-5 p vC |     |              |      |      | s vA  |          |
            |      | E-5 p v9 |     |              |      |      | s vA  |          |
            |      | G-5 p v9 |     |              |      |      | s vA  |          |
            |      | C-6 p v9 |     |              |      |      | s vA  |          |
            |      | A-4 p vC |     | A-3 g c37 fF |      |      | s vC  |          |
            |      | C-5 p v9 |     |              |      |      | s vC  |          |
            |      | E-5 p v9 |     |              |      |      | s vC  |          |
            |      | A-5 p v9 |     |              |      |      | s vC  |          |
            |      | E-5 p vC |     |              |      |      | s vC  |          |
            |      | C-5 p v9 |     |              |      |      | s vC  |          |
            |      | E-5 p v9 |     |              |      |      | s vC  |          |
            |      | A-5 p v9 |     |              |      |      | s vC  |          |
            |      | A-4 p vC |     |              |      |      | s vC  |          |
            |      | C-5 p v9 |     |              |      |      | s vC  |          |
            |      | E-5 p v9 |     |              |      |      | s vC  |          |
            |      | A-5 p v9 |     |              |      |      | s vC  |          |
            |      | E-5 p vC |     |              |      |      | s vC  |          |
            |      | C-5 p v9 |     |              |      |      | s vC  |          |
            |      | E-5 p v9 |     |              |      |      | s vC  |          |
            |      | A-5 p v9 |     |              |      |      | s vC  |          |
        `,
        drop: `
            # lead  | pluck    | pad       | gated pad | bass  | kick | snare | open hat | crash
            | A-4 L | D-5 p vC | D-4 D c37 |           |       | k    |       |          | C
            |       | F-5 p v9 |           |           |       |      |       |          |
            |       | A-5 p v9 |           |           | D-2 B |      |       | o        |
            | D-5 L | D-6 p v9 |           |           |       |      |       |          |
            |       | A-5 p vC |           |           | ===   | k    |       |          |
            |       | F-5 p v9 |           |           |       |      |       |          |
            | F-5 L | A-5 p v9 |           |           | D-2 B |      |       | o        |
            |       | D-6 p v9 |           |           |       |      |       |          |
            | E-5 L | D-5 p vC |           |           | ===   | k    |       |          |
            |       | F-5 p v9 |           |           |       |      |       |          |
            | D-5 L | A-5 p v9 |           |           | D-2 B |      |       | o        |
            |       | D-6 p v9 |           |           |       |      |       |          |
            | C-5 L | A-5 p vC |           |           | ===   | k    |       |          |
            |       | F-5 p v9 |           |           |       |      |       |          |
            | A-4 L | A-5 p v9 |           |           | D-2 B |      |       | o        |
            |       | D-6 p v9 |           |           |       |      |       |          |
            | A#4 L | A#4 p vC | A#3 D c47 |           |       | k    |       |          |
            |       | D-5 p v9 |           |           |       |      |       |          |
            |       | F-5 p v9 |           |           | A#1 B |      |       | o        |
            | D-5 L | A#5 p v9 |           |           |       |      |       |          |
            |       | F-5 p vC |           |           | ===   | k    |       |          |
            |       | D-5 p v9 |           |           |       |      |       |          |
            | F-5 L | F-5 p v9 |           |           | A#1 B |      |       | o        |
            |       | A#5 p v9 |           |           |       |      |       |          |
            |       | A#4 p vC |           |           | ===   | k    |       |          |
            |       | D-5 p v9 |           |           |       |      |       |          |
            | D-5 L | F-5 p v9 |           |           | A#1 B |      |       | o        |
            |       | A#5 p v9 |           |           |       |      |       |          |
            | F-5 L | F-5 p vC |           |           | ===   | k    |       |          |
            |       | D-5 p v9 |           |           |       |      |       |          |
            |       | F-5 p v9 |           |           | A#1 B |      |       | o        |
            |       | A#5 p v9 |           |           |       |      |       |          |
            | G-5 L | C-5 p vC | C-4 D c47 |           |       | k    |       |          |
            |       | E-5 p v9 |           |           |       |      |       |          |
            |       | G-5 p v9 |           |           | C-2 B |      |       | o        |
            | E-5 L | C-6 p v9 |           |           |       |      |       |          |
            |       | G-5 p vC |           |           | ===   | k    |       |          |
            |       | E-5 p v9 |           |           |       |      |       |          |
            | C-5 L | G-5 p v9 |           |           | C-2 B |      |       | o        |
            |       | C-6 p v9 |           |           |       |      |       |          |
            | E-5 L | C-5 p vC |           |           | ===   | k    |       |          |
            |       | E-5 p v9 |           |           |       |      |       |          |
            | G-5 L | G-5 p v9 |           |           | C-2 B |      |       | o        |
            |       | C-6 p v9 |           |           |       |      |       |          |
            | A-5 L | G-5 p vC |           |           | ===   | k    |       |          |
            |       | E-5 p v9 |           |           |       |      |       |          |
            | G-5 L | G-5 p v9 |           |           | C-2 B |      |       | o        |
            |       | C-6 p v9 |           |           |       |      |       |          |
            | E-5 L | A-4 p vC | A-3 D c37 |           |       | k    |       |          |
            |       | C-5 p v9 |           |           |       |      |       |          |
            |       | E-5 p v9 |           |           | A-1 B |      |       | o        |
            |       | A-5 p v9 |           |           |       |      |       |          |
            |       | E-5 p vC |           |           | ===   | k    |       |          |
            |       | C-5 p v9 |           |           |       |      |       |          |
            | C-5 L | E-5 p v9 |           |           | A-1 B |      |       | o        |
            |       | A-5 p v9 |           |           |       |      |       |          |
            | A-4 L | A-4 p vC |           |           | ===   | k    |       |          |
            |       | C-5 p v9 |           |           |       |      |       |          |
            |       | E-5 p v9 |           |           | A-1 B |      |       | o        |
            |       | A-5 p v9 |           |           |       |      |       |          |
            | E-5 L | E-5 p vC |           |           | ===   | k    |       |          |
            |       | C-5 p v9 |           |           |       |      |       |          |
            |       | E-5 p v9 |           |           | A-1 B |      |       | o        |
            |       | A-5 p v9 |           |           |       |      |       |          |
        `,
    },
    order: ['breakdown', 'build', 'drop', 'drop'],
    loop: 0,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const BREAKDOWN_BUILD: Tune = {
    name: 'Breakdown, Build',
    style: 'Trance',
    techniques: [
        'A supersaw lead: seven detuned saws spread across the stereo field',
        'A pad gated into sixteenths by a square LFO timed in beats',
        'The gated pad brightening bar by bar with the f token',
        'A snare roll that doubles its rate each bar',
        'Plucks through an echo timed in beats',
    ],
    song: BREAKDOWN_BUILD_SONG,
};

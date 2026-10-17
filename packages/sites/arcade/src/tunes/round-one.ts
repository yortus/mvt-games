import { createAudio90Song } from '@mvtjs/audio';
import { BRASS, FM_GUITAR, HAT, KICK, OPEN_HAT, SLAP_BASS, SNARE, TOM } from './instruments';
import { HIT } from './sample-instruments';
import type { Tune } from './tune';

/** A fighting game's stage: a slapped FM bass, brass stabs on the offbeats, orchestra hits and a guitar lick. */
export const ROUND_ONE_SONG = createAudio90Song({
    bpm: 144,
    volume: 1.43,
    character: 'console',
    instruments: { B: SLAP_BASS, R: BRASS, H: HIT, G: FM_GUITAR, k: KICK, s: SNARE, h: HAT, o: OPEN_HAT, t: TOM },
    reverb: { size: 0.5, decayMs: 1500, level: 0.3 },
    echo: { timeBeats: 0.75, feedback: 0.25, level: 0.2 },
    mixer: [
        {  },
        { pan: -0.35 },
        { pan: 0.35 },
        {  },
        { pan: 0.2 },
    ],
    patterns: {
        groove: `
            # bass     | brass | brass | hit   | guitar | kick | snare | hat  | open hat | tom
            | A-2 B vF |       |       | A-4 H |        | k    |       | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | A-2 B v8 |       |       |       |        |      |       | h v6 |          |
            | A-3 B vB |       |       |       |        |      |       | h v3 |          |
            |          |       |       |       |        |      | s     | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | G-2 B vD | C-5 R | E-5 R |       |        |      |       | h v6 |          |
            | A-2 B v9 | ===   | ===   |       |        | k    |       | h v3 |          |
            |          |       |       |       |        |      |       | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | C-3 B vD |       |       |       |        | k    |       | h v6 |          |
            | A-3 B v9 |       |       |       |        |      |       | h v3 |          |
            | A-2 B vC |       |       |       |        |      | s     | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | G-2 B vB | C-5 R | E-5 R |       |        |      |       |      | o        |
            | E-2 B v9 | ===   | ===   |       |        |      |       | h v3 |          |
            | A-2 B vF |       |       |       |        | k    |       | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | A-2 B v8 |       |       |       |        |      |       | h v6 |          |
            | A-3 B vB |       |       |       |        |      |       | h v3 |          |
            |          |       |       |       |        |      | s     | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | G-2 B vD | C-5 R | E-5 R |       |        |      |       | h v6 |          |
            | A-2 B v9 | ===   | ===   |       |        | k    |       | h v3 |          |
            |          |       |       |       |        |      |       | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | C-3 B vD |       |       |       |        | k    |       | h v6 |          |
            | A-3 B v9 |       |       |       |        |      |       | h v3 |          |
            | A-2 B vC |       |       |       |        |      | s     | h v6 |          | A-2 t
            |          |       |       |       |        |      |       | h v3 |          | G-2 t
            | G-2 B vB | C-5 R | E-5 R |       |        |      |       |      | o        | E-2 t
            | E-2 B v9 | ===   | ===   |       |        |      |       | h v3 |          | D-2 t
        `,
        lead: `
            # bass     | brass | brass | hit   | guitar | kick | snare | hat  | open hat | tom
            | A-2 B vF |       |       | A-4 H | E-5 G  | k    |       | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | A-2 B v8 |       |       |       | G-5 G  |      |       | h v6 |          |
            | A-3 B vB |       |       |       |        |      |       | h v3 |          |
            |          |       |       |       | A-5 G  |      | s     | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | G-2 B vD | C-5 R | E-5 R |       |        |      |       | h v6 |          |
            | A-2 B v9 | ===   | ===   |       |        | k    |       | h v3 |          |
            |          |       |       |       | G-5 G  |      |       | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | C-3 B vD |       |       |       | E-5 G  | k    |       | h v6 |          |
            | A-3 B v9 |       |       |       |        |      |       | h v3 |          |
            | A-2 B vC |       |       |       | D-5 G  |      | s     | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | G-2 B vB | C-5 R | E-5 R |       |        |      |       |      | o        |
            | E-2 B v9 | ===   | ===   |       |        |      |       | h v3 |          |
            | A-2 B vF |       |       |       | E-5 G  | k    |       | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | A-2 B v8 |       |       |       | G-5 G  |      |       | h v6 |          |
            | A-3 B vB |       |       |       |        |      |       | h v3 |          |
            |          |       |       |       | A-5 G  |      | s     | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | G-2 B vD | C-5 R | E-5 R |       | C-6 G  |      |       | h v6 |          |
            | A-2 B v9 | ===   | ===   |       |        | k    |       | h v3 |          |
            |          |       |       |       | A-5 G  |      |       | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | C-3 B vD |       |       |       |        | k    |       | h v6 |          |
            | A-3 B v9 |       |       |       |        |      |       | h v3 |          |
            | A-2 B vC |       |       |       |        |      | s     | h v6 |          |
            |          |       |       |       |        |      |       | h v3 |          |
            | G-2 B vB | C-5 R | E-5 R |       |        |      |       |      | o        |
            | E-2 B v9 | ===   | ===   |       |        |      |       | h v3 |          |
        `,
    },
    order: ['groove', 'groove+5', 'lead', 'lead+5', 'groove', 'groove+5', 'lead', 'lead-2'],
    loop: 0,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const ROUND_ONE: Tune = {
    name: 'Round One',
    style: 'Fighting game',
    techniques: [
        'A slapped bass of two FM operators: a pluck that snaps, then a round body',
        'Velocity on every bass note, which changes how hard the modulator bites',
        'Brass stabs on the offbeats, and the orchestra hit at the top of each phrase',
        'Tom fills to turn the phrase round',
        'The console character',
    ],
    song: ROUND_ONE_SONG,
};

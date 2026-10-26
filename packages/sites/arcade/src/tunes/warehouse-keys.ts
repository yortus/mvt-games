import { createAudio90Song } from 'audio90';
import { CLAP, HOUSE_PIANO, KICK, OPEN_HAT, ORGAN, PAD, SHAKER } from './instruments';
import type { Tune } from './tune';

/** House: piano stabs on the offbeats, an organ bass, and four to the floor, through the sevenths of A minor, F, D minor and E minor. */
export const WAREHOUSE_KEYS_SONG = createAudio90Song({
    bpm: 122,
    swing: 0.1,
    volume: 1.72,
    instruments: { P: HOUSE_PIANO, B: ORGAN, D: PAD, k: KICK, c: CLAP, o: OPEN_HAT, x: SHAKER },
    reverb: { size: 0.5, decayMs: 1400, level: 0.35 },
    mixer: [
        { pan: -0.3 },
        { pan: 0 },
        { pan: 0.3 },
        {  },
        { reverb: 0.3 },
    ],
    patterns: {
        beat: `
            # keys | keys | keys | bass | pad | kick | clap | open hat | shaker
            |      |      |      |      |     | k    |      |          | x v6
            |      |      |      |      |     |      |      |          | x v3
            |      |      |      |      |     |      |      | o        | x v6
            |      |      |      |      |     |      |      |          | x v3
            |      |      |      |      |     | k    | c    |          | x v6
            |      |      |      |      |     |      |      |          | x v3
            |      |      |      |      |     |      |      | o        | x v6
            |      |      |      |      |     |      |      |          | x v3
            |      |      |      |      |     | k    |      |          | x v6
            |      |      |      |      |     |      |      |          | x v3
            |      |      |      |      |     |      |      | o        | x v6
            |      |      |      |      |     |      |      |          | x v3
            |      |      |      |      |     | k    | c    |          | x v6
            |      |      |      |      |     |      |      |          | x v3
            |      |      |      |      |     |      |      | o        | x v6
            |      |      |      |      |     |      |      |          | x v3
        `,
        groove: `
            # keys | keys | keys | bass  | pad | kick | clap | open hat | shaker
            |      |      |      | A-2 B |     | k    |      |          | x v6
            |      |      |      |       |     |      |      |          | x v3
            |      |      |      | ===   |     |      |      | o        | x v6
            |      |      |      | A-2 B |     |      |      |          | x v3
            |      |      |      | ===   |     | k    | c    |          | x v6
            |      |      |      |       |     |      |      |          | x v3
            |      |      |      | A-3 B |     |      |      | o        | x v6
            |      |      |      | ===   |     |      |      |          | x v3
            |      |      |      |       |     | k    |      |          | x v6
            |      |      |      |       |     |      |      |          | x v3
            |      |      |      | A-2 B |     |      |      | o        | x v6
            |      |      |      | ===   |     |      |      |          | x v3
            |      |      |      | C-3 B |     | k    | c    |          | x v6
            |      |      |      | ===   |     |      |      |          | x v3
            |      |      |      | E-3 B |     |      |      | o        | x v6
            |      |      |      | ===   |     |      |      |          | x v3
        `,
        grooveF: `
            # keys | keys | keys | bass  | pad | kick | clap | open hat | shaker
            |      |      |      | F-2 B |     | k    |      |          | x v6
            |      |      |      |       |     |      |      |          | x v3
            |      |      |      | ===   |     |      |      | o        | x v6
            |      |      |      | F-2 B |     |      |      |          | x v3
            |      |      |      | ===   |     | k    | c    |          | x v6
            |      |      |      |       |     |      |      |          | x v3
            |      |      |      | F-3 B |     |      |      | o        | x v6
            |      |      |      | ===   |     |      |      |          | x v3
            |      |      |      |       |     | k    |      |          | x v6
            |      |      |      |       |     |      |      |          | x v3
            |      |      |      | F-2 B |     |      |      | o        | x v6
            |      |      |      | ===   |     |      |      |          | x v3
            |      |      |      | A-2 B |     | k    | c    |          | x v6
            |      |      |      | ===   |     |      |      |          | x v3
            |      |      |      | C-3 B |     |      |      | o        | x v6
            |      |      |      | ===   |     |      |      |          | x v3
        `,
        keys: `
            # keys     | keys     | keys     | bass  | pad | kick | clap | open hat | shaker
            | C-5 P vD | E-5 P vD | G-5 P vD | A-2 B |     | k    |      |          | x v6
            |          |          |          |       |     |      |      |          | x v3
            | ===      | ===      | ===      | ===   |     |      |      | o        | x v6
            | C-5 P vA | E-5 P vA | G-5 P vA | A-2 B |     |      |      |          | x v3
            |          |          |          | ===   |     | k    | c    |          | x v6
            | ===      | ===      | ===      |       |     |      |      |          | x v3
            | C-5 P vB | E-5 P vB | G-5 P vB | A-3 B |     |      |      | o        | x v6
            |          |          |          | ===   |     |      |      |          | x v3
            | ===      | ===      | ===      |       |     | k    |      |          | x v6
            |          |          |          |       |     |      |      |          | x v3
            | C-5 P vA | E-5 P vA | G-5 P vA | A-2 B |     |      |      | o        | x v6
            |          |          |          | ===   |     |      |      |          | x v3
            | ===      | ===      | ===      | C-3 B |     | k    | c    |          | x v6
            | C-5 P v9 | E-5 P v9 | G-5 P v9 | ===   |     |      |      |          | x v3
            |          |          |          | E-3 B |     |      |      | o        | x v6
            | ===      | ===      | ===      | ===   |     |      |      |          | x v3
        `,
        keysF: `
            # keys     | keys     | keys     | bass  | pad | kick | clap | open hat | shaker
            | A-4 P vD | C-5 P vD | E-5 P vD | F-2 B |     | k    |      |          | x v6
            |          |          |          |       |     |      |      |          | x v3
            | ===      | ===      | ===      | ===   |     |      |      | o        | x v6
            | A-4 P vA | C-5 P vA | E-5 P vA | F-2 B |     |      |      |          | x v3
            |          |          |          | ===   |     | k    | c    |          | x v6
            | ===      | ===      | ===      |       |     |      |      |          | x v3
            | A-4 P vB | C-5 P vB | E-5 P vB | F-3 B |     |      |      | o        | x v6
            |          |          |          | ===   |     |      |      |          | x v3
            | ===      | ===      | ===      |       |     | k    |      |          | x v6
            |          |          |          |       |     |      |      |          | x v3
            | A-4 P vA | C-5 P vA | E-5 P vA | F-2 B |     |      |      | o        | x v6
            |          |          |          | ===   |     |      |      |          | x v3
            | ===      | ===      | ===      | A-2 B |     | k    | c    |          | x v6
            | A-4 P v9 | C-5 P v9 | E-5 P v9 | ===   |     |      |      |          | x v3
            |          |          |          | C-3 B |     |      |      | o        | x v6
            | ===      | ===      | ===      | ===   |     |      |      |          | x v3
        `,
        lift: `
            # keys     | keys     | keys     | bass | pad       | kick | clap | open hat | shaker
            | C-5 P vD | E-5 P vD | G-5 P vD |      | A-3 D c37 |      |      |          | x v6
            |          |          |          |      |           |      |      |          | x v3
            | ===      | ===      | ===      |      |           |      |      |          | x v6
            | C-5 P vA | E-5 P vA | G-5 P vA |      |           |      |      |          | x v3
            |          |          |          |      |           |      |      |          | x v6
            | ===      | ===      | ===      |      |           |      |      |          | x v3
            | C-5 P vB | E-5 P vB | G-5 P vB |      |           |      |      |          | x v6
            |          |          |          |      |           |      |      |          | x v3
            | ===      | ===      | ===      |      |           |      |      |          | x v6
            |          |          |          |      |           |      |      |          | x v3
            | C-5 P vA | E-5 P vA | G-5 P vA |      |           |      |      |          | x v6
            |          |          |          |      |           |      |      |          | x v3
            | ===      | ===      | ===      |      |           |      |      |          | x v6
            | C-5 P v9 | E-5 P v9 | G-5 P v9 |      |           |      |      |          | x v3
            |          |          |          |      |           |      |      |          | x v6
            | ===      | ===      | ===      |      |           |      |      |          | x v3
        `,
        liftF: `
            # keys     | keys     | keys     | bass | pad       | kick | clap | open hat | shaker
            | A-4 P vD | C-5 P vD | E-5 P vD |      | F-3 D c47 |      |      |          | x v6
            |          |          |          |      |           |      |      |          | x v3
            | ===      | ===      | ===      |      |           |      |      |          | x v6
            | A-4 P vA | C-5 P vA | E-5 P vA |      |           |      |      |          | x v3
            |          |          |          |      |           |      |      |          | x v6
            | ===      | ===      | ===      |      |           |      |      |          | x v3
            | A-4 P vB | C-5 P vB | E-5 P vB |      |           |      |      |          | x v6
            |          |          |          |      |           |      |      |          | x v3
            | ===      | ===      | ===      |      |           |      |      |          | x v6
            |          |          |          |      |           |      |      |          | x v3
            | A-4 P vA | C-5 P vA | E-5 P vA |      |           |      |      |          | x v6
            |          |          |          |      |           |      |      |          | x v3
            | ===      | ===      | ===      |      |           |      |      |          | x v6
            | A-4 P v9 | C-5 P v9 | E-5 P v9 |      |           |      |      |          | x v3
            |          |          |          |      |           |      |      |          | x v6
            | ===      | ===      | ===      |      |           |      |      |          | x v3
        `,
    },
    order: ['beat', 'beat', 'groove', 'grooveF', 'keys', 'keysF', 'keys-7', 'keys-5', 'keys', 'keysF', 'keys-7', 'keys-5', 'lift', 'liftF', 'lift-7', 'lift-5', 'keys', 'keysF', 'keys-7', 'keys-5'],
    loop: 2,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const WAREHOUSE_KEYS: Tune = {
    name: 'Warehouse Keys',
    style: 'House',
    techniques: [
        'An FM piano with a hammer\'s click, struck hard on the offbeats',
        'An organ of four FM operators side by side, as drawbars',
        'One pattern moved to the minor sevenths on D and E by transposing it in the order',
        'Analog drums: a falling sine, filtered noise, a shaker on every sixteenth',
        'A swung sixteenth, as the decade\'s drum machines swung',
    ],
    song: WAREHOUSE_KEYS_SONG,
};

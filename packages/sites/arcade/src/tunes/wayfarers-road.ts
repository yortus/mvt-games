import { createAudio90Song } from '@mvtjs/chiptune';
import { FLUTE, FM_BASS, PLUCK, TIMPANI } from './instruments';
import { SAMPLED_STRINGS } from './sample-instruments';
import type { Tune } from './tune';

/** A 16-bit role-playing game's overworld: a flute over sampled strings, a harp and timpani, in a soft echo. */
export const WAYFARERS_ROAD_SONG = createAudio90Song({
    bpm: 100,
    volume: 1.03,
    character: 'console',
    instruments: { F: FLUTE, S: SAMPLED_STRINGS, B: FM_BASS, T: TIMPANI, p: PLUCK },
    reverb: { size: 0.7, decayMs: 2400, level: 0.3 },
    echo: { timeMs: 280, feedback: 0.4, toneHz: 2200, level: 0.35 },
    mixer: [
        {  },
        { pan: -0.4 },
        {  },
        { pan: 0.4 },
        {  },
        {  },
        { pan: 0.3 },
    ],
    patterns: {
        a: `
            # flute | strings | strings | strings | bass     | timpani  | harp
            | D-5 F | G-3 S   | B-3 S   | D-4 S   | G-2 B v9 | G-3 T    | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | D-5 p v7
            |       |         |         |         |          |          |
            | B-4 F |         |         |         |          |          | G-5 p v7
            |       |         |         |         |          |          |
            | D-5 F |         |         |         | G-2 B v7 |          | D-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            | G-5 F |         |         |         |          |          | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            | F#5 F | G-3 S   | B-3 S   | E-4 S   | E-2 B v9 |          | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            | E-5 F |         |         |         |          |          | E-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | G-5 p v7
            |       |         |         |         |          |          |
            | B-4 F |         |         |         | E-2 B v7 |          | E-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            | C-5 F | G-3 S   | C-4 S   | E-4 S   | C-2 B v9 | C-3 T v9 | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | C-5 p v7
            |       |         |         |         |          |          |
            | E-5 F |         |         |         |          |          | E-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | G-5 p v7
            |       |         |         |         |          |          |
            | G-5 F |         |         |         | C-2 B v7 |          | E-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | C-5 p v7
            |       |         |         |         |          |          |
            | E-5 F |         |         |         |          |          | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | C-5 p v7
            |       |         |         |         |          |          |
            | F#5 F | F#3 S   | A-3 S   | D-4 S   | D-2 B v9 |          | F#4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | A-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | D-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | F#5 p v7
            |       |         |         |         |          |          |
            | D-5 F |         |         |         | D-2 B v7 |          | D-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | A-4 p v7
            |       |         |         |         |          |          |
            | A-4 F |         |         |         |          |          | F#4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | A-4 p v7
            |       |         |         |         |          |          |
        `,
        b: `
            # flute | strings | strings | strings | bass     | timpani  | harp
            | E-5 F | G-3 S   | C-4 S   | E-4 S   | C-2 B v9 | C-3 T    | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | C-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | E-5 p v7
            |       |         |         |         |          |          |
            | D-5 F |         |         |         |          |          | G-5 p v7
            |       |         |         |         |          |          |
            | C-5 F |         |         |         | C-2 B v7 |          | E-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | C-5 p v7
            |       |         |         |         |          |          |
            | E-5 F |         |         |         |          |          | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | C-5 p v7
            |       |         |         |         |          |          |
            | D-5 F | F#3 S   | A-3 S   | D-4 S   | D-2 B v9 |          | F#4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | A-4 p v7
            |       |         |         |         |          |          |
            | F#5 F |         |         |         |          |          | D-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | F#5 p v7
            |       |         |         |         |          |          |
            | A-5 F |         |         |         | D-2 B v7 |          | D-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | A-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | F#4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | A-4 p v7
            |       |         |         |         |          |          |
            | B-4 F | F#3 S   | B-3 S   | D-4 S   | B-1 B v9 | B-2 T v9 | F#4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            | D-5 F |         |         |         |          |          | D-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | F#5 p v7
            |       |         |         |         |          |          |
            | F#5 F |         |         |         | B-1 B v7 |          | D-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            | D-5 F |         |         |         |          |          | F#4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            | E-5 F | G-3 S   | B-3 S   | E-4 S   | E-2 B v9 |          | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | E-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | G-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         | E-2 B v7 |          | E-5 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | G-4 p v7
            |       |         |         |         |          |          |
            |       |         |         |         |          |          | B-4 p v7
            |       |         |         |         |          |          |
        `,
    },
    order: ['a', 'b', 'a', 'b'],
    loop: 0,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const WAYFARERS_ROAD: Tune = {
    name: 'Wayfarer\'s Road',
    style: '16-bit role-playing game',
    techniques: [
        'Sampled strings: a held string note bounced into a sample, looped, and played at every pitch',
        'The console character\'s soft sample interpolation, which dulls the highs as the era\'s console did',
        'A flute of two FM operators, breathing in, with a slow vibrato',
        'A harp from a plucked pulse, arpeggiating the chord',
        'The echo with a filter on its repeats, each one darker',
    ],
    song: WAYFARERS_ROAD_SONG,
};

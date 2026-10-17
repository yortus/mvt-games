import { createAudio90Song } from '@mvtjs/audio';
import { BRASS, CRASH, FM_BASS, FM_GUITAR, HAT, KICK, SNARE, TOM } from './instruments';
import type { Tune } from './tune';

/** A 16-bit shooter's FM rock: a singing FM lead guitar over a chugging FM bass, brass power chords and rock drums. */
export const SCRAMBLE_WING_SONG = createAudio90Song({
    bpm: 152,
    volume: 1.15,
    character: 'console',
    instruments: { G: FM_GUITAR, B: FM_BASS, R: BRASS, k: KICK, s: SNARE, h: HAT, C: CRASH, t: TOM },
    reverb: { size: 0.4, decayMs: 1200, level: 0.25 },
    echo: { timeBeats: 0.5, feedback: 0.3, toneHz: 3000, level: 0.3 },
    mixer: [
        { pan: 0.15 },
        {  },
        { pan: -0.4 },
        { pan: 0.4 },
    ],
    patterns: {
        riff: `
            # guitar | bass     | brass | brass | kick | snare | hat  | crash | tom
            |        | E-2 B vD | E-4 R | B-4 R | k    |       | h v6 | C     |
            |        |          |       |       |      |       |      |       |
            |        | E-2 B v9 |       |       |      |       | h v4 |       |
            |        |          | ===   | ===   |      |       |      |       |
            |        | E-2 B vD |       |       |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | E-2 B v9 | E-4 R | B-4 R | k    |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            |        | E-2 B vD | ===   | ===   | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | E-2 B v9 | E-4 R | B-4 R |      |       | h v4 |       |
            |        |          |       |       | k    |       |      |       |
            |        | E-2 B vD | ===   | ===   |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | E-2 B v9 |       |       |      |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B vD | C-4 R | G-4 R | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B v9 |       |       |      |       | h v4 |       |
            |        |          | ===   | ===   |      |       |      |       |
            |        | C-2 B vD |       |       |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B v9 | C-4 R | G-4 R | k    |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B vD | ===   | ===   | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B v9 | C-4 R | G-4 R |      |       | h v4 |       |
            |        |          |       |       | k    |       |      |       |
            |        | C-2 B vD | ===   | ===   |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B v9 |       |       |      |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            |        | D-2 B vD | D-4 R | A-4 R | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | D-2 B v9 |       |       |      |       | h v4 |       |
            |        |          | ===   | ===   |      |       |      |       |
            |        | D-2 B vD |       |       |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | D-2 B v9 | D-4 R | A-4 R | k    |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            |        | D-2 B vD | ===   | ===   | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | D-2 B v9 | D-4 R | A-4 R |      |       | h v4 |       |
            |        |          |       |       | k    |       |      |       |
            |        | D-2 B vD | ===   | ===   |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | D-2 B v9 |       |       |      |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            |        | B-1 B vD | B-3 R | F#4 R | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | B-1 B v9 |       |       |      |       | h v4 |       |
            |        |          | ===   | ===   |      |       |      |       |
            |        | B-1 B vD |       |       |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | B-1 B v9 | B-3 R | F#4 R | k    |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            |        | B-1 B vD | ===   | ===   | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | B-1 B v9 | B-3 R | F#4 R |      |       | h v4 |       |
            |        |          |       |       | k    |       |      |       |
            |        | B-1 B vD | ===   | ===   |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | B-1 B v9 |       |       |      |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
        `,
        theme: `
            # guitar | bass     | brass | brass | kick | snare | hat  | crash | tom
            | B-4 G  | E-2 B vD | E-4 R | B-4 R | k    |       | h v6 | C     |
            |        |          |       |       |      |       |      |       |
            |        | E-2 B v9 |       |       |      |       | h v4 |       |
            |        |          | ===   | ===   |      |       |      |       |
            | E-5 G  | E-2 B vD |       |       |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            | F#5 G  | E-2 B v9 | E-4 R | B-4 R | k    |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            | G-5 G  | E-2 B vD | ===   | ===   | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | E-2 B v9 | E-4 R | B-4 R |      |       | h v4 |       |
            |        |          |       |       | k    |       |      |       |
            | F#5 G  | E-2 B vD | ===   | ===   |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            | E-5 G  | E-2 B v9 |       |       |      |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            | G-5 G  | C-2 B vD | C-4 R | G-4 R | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B v9 |       |       |      |       | h v4 |       |
            |        |          | ===   | ===   |      |       |      |       |
            | E-5 G  | C-2 B vD |       |       |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B v9 | C-4 R | G-4 R | k    |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            | C-5 G  | C-2 B vD | ===   | ===   | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B v9 | C-4 R | G-4 R |      |       | h v4 |       |
            |        |          |       |       | k    |       |      |       |
            | E-5 G  | C-2 B vD | ===   | ===   |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | C-2 B v9 |       |       |      |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            | F#5 G  | D-2 B vD | D-4 R | A-4 R | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | D-2 B v9 |       |       |      |       | h v4 |       |
            |        |          | ===   | ===   |      |       |      |       |
            | A-5 G  | D-2 B vD |       |       |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            | G-5 G  | D-2 B v9 | D-4 R | A-4 R | k    |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            | F#5 G  | D-2 B vD | ===   | ===   | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | D-2 B v9 | D-4 R | A-4 R |      |       | h v4 |       |
            |        |          |       |       | k    |       |      |       |
            | D-5 G  | D-2 B vD | ===   | ===   |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | D-2 B v9 |       |       |      |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            | D#5 G  | B-1 B vD | B-3 R | F#4 R | k    |       | h v6 |       |
            |        |          |       |       |      |       |      |       |
            |        | B-1 B v9 |       |       |      |       | h v4 |       |
            |        |          | ===   | ===   |      |       |      |       |
            |        | B-1 B vD |       |       |      | s     | h v6 |       |
            |        |          |       |       |      |       |      |       |
            | F#5 G  | B-1 B v9 | B-3 R | F#4 R | k    |       | h v4 |       |
            |        |          |       |       |      |       |      |       |
            | B-5 G  | B-1 B vD | ===   | ===   | k    |       | h v6 |       | D-3 t
            |        |          |       |       |      |       |      |       |
            |        | B-1 B v9 | B-3 R | F#4 R |      |       | h v4 |       | C-3 t
            |        |          |       |       | k    |       |      |       |
            |        | B-1 B vD | ===   | ===   |      | s     | h v6 |       | A#2 t
            |        |          |       |       |      |       |      |       |
            |        | B-1 B v9 |       |       |      |       | h v4 |       | G-2 t
            |        |          |       |       |      |       |      |       |
        `,
    },
    order: ['riff', 'theme', 'theme', 'riff+5', 'theme'],
    loop: 1,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const SCRAMBLE_WING: Tune = {
    name: 'Scramble Wing',
    style: '16-bit shooter',
    techniques: [
        'An FM lead guitar: one operator feeding back hard, through a driven filter',
        'A chugging FM bass on every eighth, accented on the beat',
        'FM brass as power chords: the root and the fifth',
        'The console character: FM rounded to 9 bits, with a small step at each zero crossing',
        'A tom fill to bring the theme round',
    ],
    song: SCRAMBLE_WING_SONG,
};

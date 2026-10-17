import { createAudio90Song } from '@mvtjs/audio';
import { BELL, ELECTRIC_PIANO, HAT, KICK, SNARE, SUB_BASS } from './instruments';
import { AAH } from './sample-instruments';
import type { Tune } from './tune';

/** A ballad: a glassy electric piano, a choir's "aah", and a bell's melody, in a long reverb. */
export const LANTERN_SONG = createAudio90Song({
    bpm: 72,
    volume: 0.88,
    instruments: { E: ELECTRIC_PIANO, u: SUB_BASS, A: AAH, L: BELL, k: KICK, s: SNARE, h: HAT },
    reverb: { size: 0.9, decayMs: 3500, damping: 0.5, level: 0.45 },
    chorus: { depth: 0.6, rateHz: 0.5, level: 0.5 },
    echo: { timeBeats: 0.5, feedback: 0.3, level: 0.2 },
    mixer: [
        { pan: -0.3 },
        {  },
        { pan: 0.3 },
        {  },
        { pan: -0.5 },
        { pan: 0.5 },
    ],
    patterns: {
        verse: `
            # keys     | keys     | keys     | bass  | choir | choir | bell  | kick | snare | hat
            | E-4 E vB | G-4 E vB | C-5 E vB | C-3 u | E-4 A | G-4 A | E-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | D-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            | E-4 E v7 | G-4 E v7 | C-5 E v7 |       |       |       | C-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | G-4 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | D-4 E vB | G-4 E vB | B-4 E vB | B-2 u | D-4 A | G-4 A | B-4 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | D-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | D-4 E v7 | G-4 E v7 | B-4 E v7 |       |       |       | G-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | E-4 E vB | A-4 E vB | C-5 E vB | A-2 u | C-4 A | E-4 A | A-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | G-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            | E-4 E v7 | A-4 E v7 | C-5 E v7 |       |       |       | E-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | C-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | F-4 E vB | A-4 E vB | C-5 E vB | F-2 u | C-4 A | F-4 A | C-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | A-4 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | F-4 E v7 | A-4 E v7 | C-5 E v7 |       |       |       | C-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | D-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
        `,
        chorus: `
            # keys     | keys     | keys     | bass  | choir | choir | bell  | kick | snare | hat
            | F-4 E vB | A-4 E vB | C-5 E vB | F-2 u | C-4 A | F-4 A | C-6 L | k v9 |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | A-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            | F-4 E v7 | A-4 E v7 | C-5 E v7 |       |       |       | F-5 L |      | s v6  | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       | k v7 |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | A-5 L |      |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | D-4 E vB | G-4 E vB | B-4 E vB | G-2 u | D-4 A | G-4 A | B-5 L | k v9 |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | G-5 L |      |       |
            |          |          |          |       |       |       |       |      |       |
            | D-4 E v7 | G-4 E v7 | B-4 E v7 |       |       |       | D-5 L |      | s v6  | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       | k v7 |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | E-4 E vB | G#4 E vB | B-4 E vB | E-2 u | B-3 A | E-4 A | G#5 L | k v9 |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | B-5 L |      |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | E-4 E v7 | G#4 E v7 | B-4 E v7 |       |       |       | E-6 L |      | s v6  | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       | k v7 |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | E-4 E vB | A-4 E vB | C-5 E vB | A-2 u | C-4 A | E-4 A | C-6 L | k v9 |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       | B-5 L |      |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            | E-4 E v7 | A-4 E v7 | C-5 E v7 |       |       |       | A-5 L |      | s v6  | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       | k v7 |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       | h v3
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
            |          |          |          |       |       |       |       |      |       |
        `,
    },
    order: ['verse', 'verse', 'chorus', 'chorus'],
    loop: 0,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const LANTERN: Tune = {
    name: 'Lantern',
    style: 'Ballad',
    techniques: [
        'A four-operator FM electric piano, its tine brighter the harder it is struck',
        'A choir\'s "aah" from a sample, held in a back-and-forth loop',
        'An FM bell whose modulator is not a whole multiple of the note',
        'The chorus and a long reverb, as the era\'s ballads had them',
    ],
    song: LANTERN_SONG,
};

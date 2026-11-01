import { createAudio90Song } from 'audio90';
import { BOUNCE_BASS, HAT, KICK, MARIMBA, SNARE, WHISTLE } from './instruments';
import type { Tune } from './tune';

/** A 16-bit platformer's first level: a cheerful whistled lead, a marimba's broken chords and a bouncing bass, in C major. */
export const MEADOW_HOP_SONG = createAudio90Song({
    bpm: 140,
    swing: 0.12,
    volume: 1.23,
    character: 'console',
    instruments: { W: WHISTLE, M: MARIMBA, B: BOUNCE_BASS, k: KICK, s: SNARE, h: HAT },
    reverb: { size: 0.4, decayMs: 1000, level: 0.25 },
    mixer: [
        { pan: 0.1 },
        { pan: -0.35 },
    ],
    patterns: {
        intro: `
            # lead | marimba  | bass  | kick | snare | hat
            |      | C-5 M vC | C-3 B | k    |       |
            |      |          | ===   |      |       |
            |      | E-5 v9   |       |      |       | h v5
            |      |          | C-3 B |      |       |
            |      | G-5 v9   | ===   |      | s     |
            |      |          |       |      |       |
            |      | E-5 v9   | G-3 B | k    |       | h v5
            |      |          | ===   |      |       |
            |      | C-5 vC   | C-4 B | k    |       |
            |      |          | ===   |      |       |
            |      | E-5 v9   |       |      |       | h v5
            |      |          | G-3 B |      |       |
            |      | G-5 v9   | ===   |      | s     |
            |      |          |       |      |       |
            |      | C-6 v9   | C-3 B |      |       | h v5
            |      |          | ===   |      |       |
            |      | A-4 vC   | A-2   | k    |       |
            |      |          | ===   |      |       |
            |      | C-5 v9   |       |      |       | h v5
            |      |          | A-2   |      |       |
            |      | E-5 v9   | ===   |      | s     |
            |      |          |       |      |       |
            |      | C-5 v9   | E-3   | k    |       | h v5
            |      |          | ===   |      |       |
            |      | A-4 vC   | A-3   | k    |       |
            |      |          | ===   |      |       |
            |      | C-5 v9   |       |      |       | h v5
            |      |          | E-3   |      |       |
            |      | E-5 v9   | ===   |      | s     |
            |      |          |       |      |       |
            |      | A-5 v9   | A-2   |      |       | h v5
            |      |          | ===   |      |       |
            |      | F-4 vC   | F-2   | k    |       |
            |      |          | ===   |      |       |
            |      | A-4 v9   |       |      |       | h v5
            |      |          | F-2   |      |       |
            |      | C-5 v9   | ===   |      | s     |
            |      |          |       |      |       |
            |      | A-4 v9   | C-3   | k    |       | h v5
            |      |          | ===   |      |       |
            |      | F-4 vC   | F-3   | k    |       |
            |      |          | ===   |      |       |
            |      | A-4 v9   |       |      |       | h v5
            |      |          | C-3   |      |       |
            |      | C-5 v9   | ===   |      | s     |
            |      |          |       |      |       |
            |      | F-5 v9   | F-2   |      |       | h v5
            |      |          | ===   |      |       |
            |      | G-4 vC   | G-2   | k    |       |
            |      |          | ===   |      |       |
            |      | B-4 v9   |       |      |       | h v5
            |      |          | G-2   |      |       |
            |      | D-5 v9   | ===   |      | s     |
            |      |          |       |      |       |
            |      | B-4 v9   | D-3   | k    |       | h v5
            |      |          | ===   |      |       |
            |      | G-4 vC   | G-3   | k    |       |
            |      |          | ===   |      |       |
            |      | B-4 v9   |       |      |       | h v5
            |      |          | D-3   |      |       |
            |      | D-5 v9   | ===   |      | s     |
            |      |          |       |      |       |
            |      | G-5 v9   | G-2   |      |       | h v5
            |      |          | ===   |      |       |
        `,
        theme: `
            # lead  | marimba  | bass  | kick | snare | hat
            | G-5 W | C-5 M vC | C-3 B | k    |       |
            |       |          | ===   |      |       |
            | E-5 W | E-5 v9   |       |      |       | h v5
            |       |          | C-3 B |      |       |
            | G-5 W | G-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | C-6 W | E-5 v9   | G-3 B | k    |       | h v5
            |       |          | ===   |      |       |
            |       | C-5 vC   | C-4 B | k    |       |
            |       |          | ===   |      |       |
            | B-5 W | E-5 v9   |       |      |       | h v5
            |       |          | G-3 B |      |       |
            | A-5 W | G-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | G-5 W | C-6 v9   | C-3 B |      |       | h v5
            |       |          | ===   |      |       |
            | A-5   | A-4 vC   | A-2   | k    |       |
            |       |          | ===   |      |       |
            |       | C-5 v9   |       |      |       | h v5
            |       |          | A-2   |      |       |
            | C-6   | E-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | A-5   | C-5 v9   | E-3   | k    |       | h v5
            |       |          | ===   |      |       |
            | E-5   | A-4 vC   | A-3   | k    |       |
            |       |          | ===   |      |       |
            |       | C-5 v9   |       |      |       | h v5
            |       |          | E-3   |      |       |
            | G-5   | E-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | A-5 v9   | A-2   |      |       | h v5
            |       |          | ===   |      |       |
            | F-5   | F-4 vC   | F-2   | k    |       |
            |       |          | ===   |      |       |
            | A-5   | A-4 v9   |       |      |       | h v5
            |       |          | F-2   |      |       |
            | C-6   | C-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | A-4 v9   | C-3   | k    |       | h v5
            |       |          | ===   |      |       |
            | D-6   | F-4 vC   | F-3   | k    |       |
            |       |          | ===   |      |       |
            | C-6   | A-4 v9   |       |      |       | h v5
            |       |          | C-3   |      |       |
            | A-5   | C-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | F-5 v9   | F-2   |      |       | h v5
            |       |          | ===   |      |       |
            | B-5   | G-4 vC   | G-2   | k    |       |
            |       |          | ===   |      |       |
            |       | B-4 v9   |       |      |       | h v5
            |       |          | G-2   |      |       |
            | D-6   | D-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | B-5   | B-4 v9   | D-3   | k    |       | h v5
            |       |          | ===   |      |       |
            | G-5 ~ | G-4 vC   | G-3   | k    |       |
            |       |          | ===   |      |       |
            |       | B-4 v9   |       |      |       | h v5
            |       |          | D-3   |      |       |
            |       | D-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | G-5 v9   | G-2   |      |       | h v5
            |       |          | ===   |      |       |
        `,
        home: `
            # lead  | marimba  | bass  | kick | snare | hat
            | G-5 W | C-5 M vC | C-3 B | k    |       |
            |       |          | ===   |      |       |
            | E-5 W | E-5 v9   |       |      |       | h v5
            |       |          | C-3 B |      |       |
            | G-5 W | G-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | C-6 W | E-5 v9   | G-3 B | k    |       | h v5
            |       |          | ===   |      |       |
            |       | C-5 vC   | C-4 B | k    |       |
            |       |          | ===   |      |       |
            | B-5 W | E-5 v9   |       |      |       | h v5
            |       |          | G-3 B |      |       |
            | A-5 W | G-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | G-5 W | C-6 v9   | C-3 B |      |       | h v5
            |       |          | ===   |      |       |
            | A-5   | A-4 vC   | A-2   | k    |       |
            |       |          | ===   |      |       |
            |       | C-5 v9   |       |      |       | h v5
            |       |          | A-2   |      |       |
            | C-6   | E-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | A-5   | C-5 v9   | E-3   | k    |       | h v5
            |       |          | ===   |      |       |
            | E-5   | A-4 vC   | A-3   | k    |       |
            |       |          | ===   |      |       |
            |       | C-5 v9   |       |      |       | h v5
            |       |          | E-3   |      |       |
            | G-5   | E-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | A-5 v9   | A-2   |      |       | h v5
            |       |          | ===   |      |       |
            | F-5   | F-4 vC   | F-2   | k    |       |
            |       |          | ===   |      |       |
            | A-5   | A-4 v9   |       |      |       | h v5
            |       |          | F-2   |      |       |
            | C-6   | C-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | A-4 v9   | C-3   | k    |       | h v5
            |       |          | ===   |      |       |
            | D-6   | F-4 vC   | F-3   | k    |       |
            |       |          | ===   |      |       |
            | C-6   | A-4 v9   |       |      |       | h v5
            |       |          | C-3   |      |       |
            | A-5   | C-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | F-5 v9   | F-2   |      |       | h v5
            |       |          | ===   |      |       |
            | B-5   | G-4 vC   | G-2   | k    |       |
            |       |          | ===   |      |       |
            | A-5   | B-4 v9   |       |      |       | h v5
            |       |          | G-2   |      |       |
            | G-5   | D-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | D-6   | B-4 v9   | D-3   | k    |       | h v5
            |       |          | ===   |      |       |
            | C-6 ~ | G-4 vC   | G-3   | k    |       |
            |       |          | ===   |      |       |
            |       | B-4 v9   |       |      |       | h v5
            |       |          | D-3   |      |       |
            |       | D-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | G-5 v9   | G-2   |      |       | h v5
            |       |          | ===   |      |       |
        `,
        bridge: `
            # lead  | marimba  | bass  | kick | snare | hat
            | A-5 W | F-4 M vC | F-2 B | k    |       |
            |       |          | ===   |      |       |
            |       | A-4 v9   |       |      |       | h v5
            |       |          | F-2 B |      |       |
            |       | C-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | C-6 W | A-4 v9   | C-3 B | k    |       | h v5
            |       |          | ===   |      |       |
            | F-6 W | F-4 vC   | F-3 B | k    |       |
            |       |          | ===   |      |       |
            |       | A-4 v9   |       |      |       | h v5
            |       |          | C-3 B |      |       |
            | E-6 W | C-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | F-5 v9   | F-2 B |      |       | h v5
            |       |          | ===   |      |       |
            | D-6   | G-4 vC   | G-2   | k    |       |
            |       |          | ===   |      |       |
            |       | B-4 v9   |       |      |       | h v5
            |       |          | G-2   |      |       |
            |       | D-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            | B-5   | B-4 v9   | D-3   | k    |       | h v5
            |       |          | ===   |      |       |
            | G-5 ~ | G-4 vC   | G-3   | k    |       |
            |       |          | ===   |      |       |
            |       | B-4 v9   |       |      |       | h v5
            |       |          | D-3   |      |       |
            |       | D-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | G-5 v9   | G-2   |      |       | h v5
            |       |          | ===   |      |       |
            | G-5   | E-4 vC   | E-2   | k    |       |
            |       |          | ===   |      |       |
            |       | G-4 v9   |       |      |       | h v5
            |       |          | E-2   |      |       |
            | B-5   | B-4 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | G-4 v9   | B-2   | k    |       | h v5
            |       |          | ===   |      |       |
            | E-6   | E-4 vC   | E-3   | k    |       |
            |       |          | ===   |      |       |
            |       | G-4 v9   |       |      |       | h v5
            |       |          | B-2   |      |       |
            | D-6   | B-4 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | E-5 v9   | E-2   |      |       | h v5
            |       |          | ===   |      |       |
            | C-6   | A-4 vC   | A-2   | k    |       |
            |       |          | ===   |      |       |
            |       | C-5 v9   |       |      |       | h v5
            |       |          | A-2   |      |       |
            | B-5   | E-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | C-5 v9   | E-3   | k    |       | h v5
            |       |          | ===   |      |       |
            | A-5   | A-4 vC   | A-3   | k    |       |
            |       |          | ===   |      |       |
            |       | C-5 v9   |       |      |       | h v5
            |       |          | E-3   |      |       |
            | G#5   | E-5 v9   | ===   |      | s     |
            |       |          |       |      |       |
            |       | A-5 v9   | A-2   |      |       | h v5
            |       |          | ===   |      |       |
        `,
    },
    order: ['intro', 'theme', 'home', 'bridge', 'theme', 'home'],
    loop: 1,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const MEADOW_HOP: Tune = {
    name: 'Meadow Hop',
    style: '16-bit platformer',
    techniques: [
        'A whistling lead of two FM operators, with a quick vibrato on the long notes',
        'A marimba of two operators, a modulator four times the note, playing broken chords',
        'A bouncing FM bass: the root, the fifth and the octave, short',
        'A light swing, and the console character',
    ],
    song: MEADOW_HOP_SONG,
};

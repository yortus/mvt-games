import { createAudio90Song } from '@mvtjs/chiptune';
import { MOD_BASS, MOD_CHORD, MOD_HAT, MOD_KICK, MOD_LEAD, MOD_SNARE } from './sample-instruments';
import type { Tune } from './tune';

/** An Amiga module: four channels of 8-bit samples, panned hard left and right, as the demoscene's trackers played them. */
export const COPPER_SKY_SONG = createAudio90Song({
    bpm: 125,
    volume: 0.76,
    character: 'sampler',
    instruments: { B: MOD_BASS, L: MOD_LEAD, C: MOD_CHORD, k: MOD_KICK, s: MOD_SNARE, h: MOD_HAT },
    mixer: [
        { pan: -0.9 },
        { pan: 0.9 },
        { pan: 0.9 },
        { pan: -0.9 },
    ],
    patterns: {
        intro: `
            # bass (left) | lead (right) | chords (right) | drums (left)
            | A-2 B       |              | A-4 C a37      | k
            |             |              |                |
            | A-2         |              |                | h v8
            |             |              |                |
            | A-3         |              |                | s
            |             |              |                |
            | A-2         |              |                | h v8
            |             |              |                |
            | A-2         |              |                | k
            |             |              |                |
            | A-3         |              |                | k vB
            |             |              |                |
            | A-2         |              |                | s
            |             |              |                |
            | A-3         |              |                | h v8
            |             |              |                |
            | F-2         |              | F-4 a47        | k
            |             |              |                |
            | F-2         |              |                | h v8
            |             |              |                |
            | F-3         |              |                | s
            |             |              |                |
            | F-2         |              |                | h v8
            |             |              |                |
            | F-2         |              |                | k
            |             |              |                |
            | F-3         |              |                | k vB
            |             |              |                |
            | F-2         |              |                | s
            |             |              |                |
            | F-3         |              |                | h v8
            |             |              |                |
            | C-3         |              | C-5 a47        | k
            |             |              |                |
            | C-3         |              |                | h v8
            |             |              |                |
            | C-4         |              |                | s
            |             |              |                |
            | C-3         |              |                | h v8
            |             |              |                |
            | C-3         |              |                | k
            |             |              |                |
            | C-4         |              |                | k vB
            |             |              |                |
            | C-3         |              |                | s
            |             |              |                |
            | C-4         |              |                | h v8
            |             |              |                |
            | G-2         |              | G-4 a47        | k
            |             |              |                |
            | G-2         |              |                | h v8
            |             |              |                |
            | G-3         |              |                | s
            |             |              |                |
            | G-2         |              |                | h v8
            |             |              |                |
            | G-2         |              |                | k
            |             |              |                |
            | G-3         |              |                | k vB
            |             |              |                |
            | G-2         |              |                | s
            |             |              |                |
            | G-3         |              |                | s vA
            |             |              |                |
        `,
        theme: `
            # bass (left) | lead (right) | chords (right) | drums (left)
            | A-2 B       | E-5 L        | A-4 C a37      | k
            |             |              |                |
            | A-2         |              |                | h v8
            |             |              |                |
            | A-3         | A-5 L        |                | s
            |             |              |                |
            | A-2         |              |                | h v8
            |             |              |                |
            | A-2         | G-5 L        |                | k
            |             |              |                |
            | A-3         | E-5 L        |                | k vB
            |             |              |                |
            | A-2         | C-5 L        |                | s
            |             |              |                |
            | A-3         |              |                | h v8
            |             |              |                |
            | F-2         | D-5          | F-4 a47        | k
            |             |              |                |
            | F-2         | C-5          |                | h v8
            |             |              |                |
            | F-3         | A-4          |                | s
            |             |              |                |
            | F-2         |              |                | h v8
            |             |              |                |
            | F-2         | C-5          |                | k
            |             |              |                |
            | F-3         |              |                | k vB
            |             |              |                |
            | F-2         | F-5          |                | s
            |             |              |                |
            | F-3         |              |                | h v8
            |             |              |                |
            | C-3         | E-5          | C-5 a47        | k
            |             |              |                |
            | C-3         |              |                | h v8
            |             |              |                |
            | C-4         |              |                | s
            |             |              |                |
            | C-3         | D-5          |                | h v8
            |             |              |                |
            | C-3         | C-5          |                | k
            |             |              |                |
            | C-4         | D-5          |                | k vB
            |             |              |                |
            | C-3         | E-5          |                | s
            |             |              |                |
            | C-4         |              |                | h v8
            |             |              |                |
            | G-2         | D-5 ~        | G-4 a47        | k
            |             |              |                |
            | G-2         |              |                | h v8
            |             |              |                |
            | G-3         |              |                | s
            |             |              |                |
            | G-2         |              |                | h v8
            |             |              |                |
            | G-2         | B-4          |                | k
            |             |              |                |
            | G-3         |              |                | k vB
            |             |              |                |
            | G-2         | G-4          |                | s
            |             |              |                |
            | G-3         |              |                | s vA
            |             |              |                |
        `,
        answer: `
            # bass (left) | lead (right) | chords (right) | drums (left)
            | A-2 B       | C-6 L        | A-4 C a37      | k
            |             |              |                |
            | A-2         |              |                | h v8
            |             |              |                |
            | A-3         | B-5 L        |                | s
            |             |              |                |
            | A-2         | A-5 L        |                | h v8
            |             |              |                |
            | A-2         | G-5 L        |                | k
            |             |              |                |
            | A-3         |              |                | k vB
            |             |              |                |
            | A-2         | E-5 L        |                | s
            |             |              |                |
            | A-3         |              |                | h v8
            |             |              |                |
            | F-2         | F-5          | F-4 a47        | k
            |             |              |                |
            | F-2         |              |                | h v8
            |             |              |                |
            | F-3         | E-5          |                | s
            |             |              |                |
            | F-2         | D-5          |                | h v8
            |             |              |                |
            | F-2         | C-5          |                | k
            |             |              |                |
            | F-3         |              |                | k vB
            |             |              |                |
            | F-2         | A-4          |                | s
            |             |              |                |
            | F-3         |              |                | h v8
            |             |              |                |
            | C-3         | G-5          | C-5 a47        | k
            |             |              |                |
            | C-3         |              |                | h v8
            |             |              |                |
            | C-4         | E-5          |                | s
            |             |              |                |
            | C-3         |              |                | h v8
            |             |              |                |
            | C-3         | C-6          |                | k
            |             |              |                |
            | C-4         |              |                | k vB
            |             |              |                |
            | C-3         | B-5          |                | s
            |             |              |                |
            | C-4         |              |                | h v8
            |             |              |                |
            | G-2         | A-5 ~        | G-4 a47        | k
            |             |              |                |
            | G-2         |              |                | h v8
            |             |              |                |
            | G-3         |              |                | s
            |             |              |                |
            | G-2         |              |                | h v8
            |             |              |                |
            | G-2         |              |                | k
            |             |              |                |
            | G-3         |              |                | k vB
            |             |              |                |
            | G-2         | G#5          |                | s
            |             |              |                |
            | G-3         |              |                | s vA
            |             |              |                |
        `,
        calm: `
            # bass (left) | lead (right) | chords (right) | drums (left)
            | A-2 B v9    | A-5 ~ L      | A-4 C a37      | h v6
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                | h v6
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            | F-2 v9      | A-5 ~        | F-4 a47        | h v6
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             | C-6 ~        |                | h v6
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            | C-3 v9      | G-5 ~        | C-5 a47        | h v6
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                | h v6
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            | G-2 v9      | B-5 ~        | G-4 a47        | h v6
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             |              |                | h v6
            |             |              |                |
            |             |              |                |
            |             |              |                |
            |             | G#5          |                |
            |             |              |                |
            |             |              |                |
            |             |              |                |
        `,
    },
    order: ['intro', 'theme', 'answer', 'theme', 'calm', 'answer'],
    loop: 1,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const COPPER_SKY: Tune = {
    name: 'Copper Sky',
    style: 'Amiga module',
    techniques: [
        'Four channels, panned hard left and right in pairs, as the Amiga\'s sound chip had them',
        'Samples bounced at 16.5 kHz and 8 bits, their tones looped over a whole number of cycles',
        'The sampler character: no smoothing between the samples, so the 8-bit grit stays',
        'Chords as fast arpeggios on the lead\'s own sample (a37, a47)',
        'Vibrato on the held notes, as the trackers added it',
    ],
    song: COPPER_SKY_SONG,
};

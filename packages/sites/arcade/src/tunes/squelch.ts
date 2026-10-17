import { createAudio90Song } from '@mvtjs/audio';
import { ACID, CLAP, HAT, KICK, OPEN_HAT, STAB } from './instruments';
import type { Tune } from './tune';

/** Acid: one saw through a resonant filter that snaps shut, with accents and slides, opening over the tune. */
export const SQUELCH_SONG = createAudio90Song({
    bpm: 126,
    rowsPerBeat: 8,
    volume: 2.26,
    instruments: { a: ACID, k: KICK, c: CLAP, h: HAT, o: OPEN_HAT, S: STAB },
    reverb: { size: 0.4, decayMs: 1200, level: 0.3 },
    echo: { timeBeats: 0.75, feedback: 0.35, level: 0.25 },
    patterns: {
        intro: `
            # acid | kick | clap | hat  | open hat | stab
            |      | k    |      | h v3 |          |
            |      |      |      |      |          |
            |      |      |      | h v6 |          |
            |      |      |      |      |          |
            |      |      |      | h v3 |          |
            |      |      |      |      |          |
            |      |      |      | h v6 |          |
            |      |      |      |      |          |
            |      | k    |      | h v3 |          |
            |      |      |      |      |          |
            |      |      |      | h v6 |          |
            |      |      |      |      |          |
            |      |      |      | h v3 |          |
            |      |      |      |      |          |
            |      |      |      | h v6 |          |
            |      |      |      |      |          |
            |      | k    |      | h v3 |          |
            |      |      |      |      |          |
            |      |      |      | h v6 |          |
            |      |      |      |      |          |
            |      |      |      | h v3 |          |
            |      |      |      |      |          |
            |      |      |      | h v6 |          |
            |      |      |      |      |          |
            |      | k    |      | h v3 |          |
            |      |      |      |      |          |
            |      |      |      | h v6 |          |
            |      |      |      |      |          |
            |      |      |      | h v3 |          |
            |      |      |      |      |          |
            |      |      |      | h v6 |          |
            |      |      |      |      |          |
        `,
        acid4: `
            # acid       | kick | clap | hat  | open hat | stab
            | A-2 a ! f4 | k    |      | h v3 |          |
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a !    | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | D#3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | E-3 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-2 a !    | k    |      | h v3 |          |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a      | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | D-3 a !    |      |      | h v6 |          |
            |            |      |      |      |          |
            | C-3 a      |      |      | h v3 | o        |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            |            |      |      |      |          |
        `,
        acid7: `
            # acid       | kick | clap | hat  | open hat | stab
            | A-2 a ! f7 | k    |      | h v3 |          |
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a !    | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | D#3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | E-3 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-2 a !    | k    |      | h v3 |          |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a      | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | D-3 a !    |      |      | h v6 |          |
            |            |      |      |      |          |
            | C-3 a      |      |      | h v3 | o        |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            |            |      |      |      |          |
        `,
        acidA: `
            # acid       | kick | clap | hat  | open hat | stab
            | A-2 a ! fA | k    |      | h v3 |          |
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a !    | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | D#3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | E-3 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-2 a !    | k    |      | h v3 |          |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a      | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | D-3 a !    |      |      | h v6 |          |
            |            |      |      |      |          |
            | C-3 a      |      |      | h v3 | o        |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            |            |      |      |      |          |
        `,
        acidD: `
            # acid       | kick | clap | hat  | open hat | stab
            | A-2 a ! fD | k    |      | h v3 |          | A-4 S c37
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a !    | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | D#3 a      |      |      | h v3 | o        | A-4 S c37 v9
            |            |      |      |      |          |
            | E-3 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-2 a !    | k    |      | h v3 |          |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a      | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | D-3 a !    |      |      | h v6 |          |
            |            |      |      |      |          |
            | C-3 a      |      |      | h v3 | o        |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            |            |      |      |      |          |
        `,
        acidF: `
            # acid       | kick | clap | hat  | open hat | stab
            | A-2 a ! fF | k    |      | h v3 |          | A-4 S c37
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a !    | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | D#3 a      |      |      | h v3 | o        | A-4 S c37 v9
            |            |      |      |      |          |
            | E-3 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-2 a !    | k    |      | h v3 |          |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | A-3 a      |      |      | h v3 | o        |
            |            |      |      |      |          |
            | A-2 a      |      |      | h v6 |          |
            | ===        |      |      |      |          |
            | C-3 a      | k    | c    | h v3 |          |
            | ===        |      |      |      |          |
            | D-3 a !    |      |      | h v6 |          |
            |            |      |      |      |          |
            | C-3 a      |      |      | h v3 | o        |
            | ===        |      |      |      |          |
            | G-2 a      |      |      | h v6 |          |
            |            |      |      |      |          |
        `,
    },
    order: ['intro', 'intro', 'acid4', 'acid7', 'acidA', 'acidD', 'acidF', 'acidF', 'acidD+5', 'acidF+5', 'acidD', 'acidA', 'acid7', 'acid4'],
    loop: 2,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const SQUELCH: Tune = {
    name: 'Squelch',
    style: 'Acid house',
    techniques: [
        'One saw into a resonant 24 dB filter, with a filter envelope that snaps shut',
        'Accents (!) that open the filter further and play louder',
        'Slides: a legato instrument glides into a note that overlaps the one before',
        'The filter opened a step at a time across the tune with the f token',
        'Eight rows a beat, so each sixteenth is a note and its release',
    ],
    song: SQUELCH_SONG,
};

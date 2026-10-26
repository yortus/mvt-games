import { createAudio90Song } from 'audio90';
import { CLAP, CRASH, EURO_BASS, EURO_LEAD, HAT, KICK, OPEN_HAT, STAB } from './instruments';
import type { Tune } from './tune';

/** A racing game's Eurobeat: a bright lead over an octave bass, stabs on the offbeats, and four to the floor, fast. */
export const HAIRPIN_NIGHT_SONG = createAudio90Song({
    bpm: 156,
    volume: 1.68,
    instruments: { L: EURO_LEAD, S: STAB, B: EURO_BASS, k: KICK, c: CLAP, h: HAT, o: OPEN_HAT, x: CRASH },
    reverb: { size: 0.5, decayMs: 1300, level: 0.3 },
    echo: { timeBeats: 0.75, feedback: 0.3, isPingPong: true, level: 0.3 },
    mixer: [
        { pan: 0 },
        { pan: 0.25 },
        { pan: -0.25 },
    ],
    patterns: {
        intro: `
            # lead  | lead, octave down | stabs        | bass  | kick | clap | hat  | open hat | crash
            |       |                   |              | A-2 B | k    |      |      |          | x
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | A-4 S c37 vC | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | A-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | A-4 c37 vA   | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | A-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | A-4 c37 vC   | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | A-2   | k    | c    |      |          |
            |       |                   | A-4 c37 vA   |       |      |      | h v5 |          |
            |       |                   |              | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | F-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | F-4 c47 vC   | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | F-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | F-4 c47 vA   | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | F-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | F-4 c47 vC   | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | F-2   | k    | c    |      |          |
            |       |                   | F-4 c47 vA   |       |      |      | h v5 |          |
            |       |                   |              | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | G-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | G-4 c47 vC   | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | G-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | G-4 c47 vA   | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | G-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | G-4 c47 vC   | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | G-2   | k    | c    |      |          |
            |       |                   | G-4 c47 vA   |       |      |      | h v5 |          |
            |       |                   |              | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | E-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | E-4 c37 vC   | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | E-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | E-4 c37 vA   | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | E-5 L |                   |              | E-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | G-5 L |                   | E-4 c37 vC   | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5 L |                   |              | E-2   | k    | c    |      |          |
            |       |                   | E-4 c37 vA   |       |      |      | h v5 |          |
            | B-5 L |                   |              | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
        `,
        verse: `
            # lead  | lead, octave down | stabs        | bass  | kick | clap | hat  | open hat | crash
            | E-5 L |                   |              | A-2 B | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5 L |                   | A-4 S c37 vC | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | C-6 L |                   |              | A-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | B-5 L |                   | A-4 c37 vA   | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5 L |                   |              | A-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | A-4 c37 vC   | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | E-5 L |                   |              | A-2   | k    | c    |      |          |
            |       |                   | A-4 c37 vA   |       |      |      | h v5 |          |
            |       |                   |              | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | F-5   |                   |              | F-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5   |                   | F-4 c47 vC   | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | C-6   |                   |              | F-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5   |                   | F-4 c47 vA   | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | G-5   |                   |              | F-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | F-4 c47 vC   | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | F-5   |                   |              | F-2   | k    | c    |      |          |
            |       |                   | F-4 c47 vA   |       |      |      | h v5 |          |
            |       |                   |              | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | G-5   |                   |              | G-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | B-5   |                   | G-4 c47 vC   | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | D-6   |                   |              | G-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | B-5   |                   | G-4 c47 vA   | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5   |                   |              | G-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | G-4 c47 vC   | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | G-5   |                   |              | G-2   | k    | c    |      |          |
            |       |                   | G-4 c47 vA   |       |      |      | h v5 |          |
            |       |                   |              | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | E-5   |                   |              | E-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | E-4 c37 vC   | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | E-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | E-4 c37 vA   | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | G-5   |                   |              | E-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | E-4 c37 vC   | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | B-5   |                   |              | E-2   | k    | c    |      |          |
            |       |                   | E-4 c37 vA   |       |      |      | h v5 |          |
            |       |                   |              | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
        `,
        chorus: `
            # lead  | lead, octave down | stabs        | bass  | kick | clap | hat  | open hat | crash
            | A-5 L | A-4 L v9          |              | F-2 B | k    |      |      |          | x
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | F-4 S c47 vC | F-3   |      |      |      | o        |
            | C-6 L | C-5 L v9          |              |       |      |      | h v5 |          |
            |       |                   |              | F-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5 L | A-4 L v9          | F-4 c47 vA   | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | G-5 L | G-4 L v9          |              | F-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5 L | A-4 L v9          | F-4 c47 vC   | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | C-6 L | C-5 L v9          |              | F-2   | k    | c    |      |          |
            |       |                   | F-4 c47 vA   |       |      |      | h v5 |          |
            |       |                   |              | F-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | B-5   | B-4 v9            |              | G-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | G-4 c47 vC   | G-3   |      |      |      | o        |
            | D-6   | D-5 v9            |              |       |      |      | h v5 |          |
            |       |                   |              | G-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | B-5   | B-4 v9            | G-4 c47 vA   | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5   | A-4 v9            |              | G-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | B-5   | B-4 v9            | G-4 c47 vC   | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | D-6   | D-5 v9            |              | G-2   | k    | c    |      |          |
            |       |                   | G-4 c47 vA   |       |      |      | h v5 |          |
            |       |                   |              | G-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | E-6   | E-5 v9            |              | E-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | E-4 c37 vC   | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | E-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | D-6   | D-5 v9            | E-4 c37 vA   | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | B-5   | B-4 v9            |              | E-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | E-4 c37 vC   | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | G-5   | G-4 v9            |              | E-2   | k    | c    |      |          |
            |       |                   | E-4 c37 vA   |       |      |      | h v5 |          |
            |       |                   |              | E-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5   | A-4 v9            |              | A-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | A-4 c37 vC   | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   |              | A-2   | k    | c    |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            |       |                   | A-4 c37 vA   | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | E-5   | E-4 v9            |              | A-2   | k    |      |      |          |
            |       |                   |              |       |      |      | h v5 |          |
            | G-5   | G-4 v9            | A-4 c37 vC   | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
            | A-5   | A-4 v9            |              | A-2   | k    | c    |      |          |
            |       |                   | A-4 c37 vA   |       |      |      | h v5 |          |
            |       |                   |              | A-3   |      |      |      | o        |
            |       |                   |              |       |      |      | h v5 |          |
        `,
    },
    order: ['intro', 'verse', 'verse', 'chorus', 'chorus', 'intro', 'verse', 'chorus', 'chorus'],
    loop: 1,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const HAIRPIN_NIGHT: Tune = {
    name: 'Hairpin Night',
    style: 'Racing game Eurobeat',
    techniques: [
        'The octave bass: the root on the beat, the octave on the offbeat',
        'A lead of three bright saws, doubled an octave down in the chorus',
        'Rave stabs as whole chords from one voice (c37, c47), on the offbeats',
        'A verse in A minor lifting into a chorus that starts on F',
        'Open hats on every offbeat, at 156 beats a minute',
    ],
    song: HAIRPIN_NIGHT_SONG,
};

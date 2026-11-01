import { createAudio90Song } from 'audio90';
import { CARD_BASS, CARD_CHORD, CARD_LEAD, HAT, KICK, SNARE } from './instruments';
import type { Tune } from './tune';

/** A PC sound card's tune: two-operator FM, its chords as fast arpeggios, as tracker music played them. */
export const SETUP_COMPLETE_SONG = createAudio90Song({
    bpm: 125,
    volume: 1.66,
    instruments: { L: CARD_LEAD, C: CARD_CHORD, B: CARD_BASS, k: KICK, s: SNARE, h: HAT },
    mixer: [
        { pan: 0.15 },
        { pan: -0.25 },
    ],
    patterns: {
        arps: `
            # lead | chord     | bass     | kick | snare | hat
            |      | C-4 C a37 | C-2 B vC | k    |       |
            |      |           |          |      |       |
            |      |           | C-3 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      |           | C-2 B vC |      | s     |
            |      |           |          |      |       |
            |      |           | C-3 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      |           | C-2 B vC | k    |       |
            |      |           |          |      |       |
            |      |           | C-3 B v9 | k    |       | h v5
            |      |           |          |      |       |
            |      |           | C-2 B vC |      | s     |
            |      |           |          |      |       |
            |      |           | C-3 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      | G#3 C a47 | G#1 B vC | k    |       |
            |      |           |          |      |       |
            |      |           | G#2 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      |           | G#1 B vC |      | s     |
            |      |           |          |      |       |
            |      |           | G#2 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      |           | G#1 B vC | k    |       |
            |      |           |          |      |       |
            |      |           | G#2 B v9 | k    |       | h v5
            |      |           |          |      |       |
            |      |           | G#1 B vC |      | s     |
            |      |           |          |      |       |
            |      |           | G#2 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      | A#3 C a47 | A#1 B vC | k    |       |
            |      |           |          |      |       |
            |      |           | A#2 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      |           | A#1 B vC |      | s     |
            |      |           |          |      |       |
            |      |           | A#2 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      |           | A#1 B vC | k    |       |
            |      |           |          |      |       |
            |      |           | A#2 B v9 | k    |       | h v5
            |      |           |          |      |       |
            |      |           | A#1 B vC |      | s     |
            |      |           |          |      |       |
            |      |           | A#2 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      | G-3 C a37 | G-1 B vC | k    |       |
            |      |           |          |      |       |
            |      |           | G-2 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      |           | G-1 B vC |      | s     |
            |      |           |          |      |       |
            |      |           | G-2 B v9 |      |       | h v5
            |      |           |          |      |       |
            |      |           | G-1 B vC | k    |       |
            |      |           |          |      |       |
            |      |           | G-2 B v9 | k    |       | h v5
            |      |           |          |      |       |
            |      |           | G-1 B vC |      | s     |
            |      |           |          |      |       |
            |      |           | G-2 B v9 |      |       | h v5
            |      |           |          |      |       |
        `,
        verse: `
            # lead  | chord     | bass     | kick | snare | hat
            | G-5 L | C-4 C a37 | C-2 B vC | k    |       |
            |       |           |          |      |       |
            |       |           | C-3 B v9 |      |       | h v5
            | D#5 L |           |          |      |       |
            |       |           | C-2 B vC |      | s     |
            |       |           |          |      |       |
            | C-5 L |           | C-3 B v9 |      |       | h v5
            |       |           |          |      |       |
            | D-5 L |           | C-2 B vC | k    |       |
            |       |           |          |      |       |
            | D#5 L |           | C-3 B v9 | k    |       | h v5
            |       |           |          |      |       |
            | F-5 L |           | C-2 B vC |      | s     |
            |       |           |          |      |       |
            | G-5 L |           | C-3 B v9 |      |       | h v5
            |       |           |          |      |       |
            | G#5 L | G#3 C a47 | G#1 B vC | k    |       |
            |       |           |          |      |       |
            |       |           | G#2 B v9 |      |       | h v5
            |       |           |          |      |       |
            |       |           | G#1 B vC |      | s     |
            |       |           |          |      |       |
            | G-5 L |           | G#2 B v9 |      |       | h v5
            |       |           |          |      |       |
            | F-5 L |           | G#1 B vC | k    |       |
            |       |           |          |      |       |
            |       |           | G#2 B v9 | k    |       | h v5
            |       |           |          |      |       |
            | D#5 L |           | G#1 B vC |      | s     |
            |       |           |          |      |       |
            |       |           | G#2 B v9 |      |       | h v5
            |       |           |          |      |       |
            | F-5 L | A#3 C a47 | A#1 B vC | k    |       |
            |       |           |          |      |       |
            |       |           | A#2 B v9 |      |       | h v5
            | D-5 L |           |          |      |       |
            |       |           | A#1 B vC |      | s     |
            |       |           |          |      |       |
            | A#4 L |           | A#2 B v9 |      |       | h v5
            |       |           |          |      |       |
            | C-5 L |           | A#1 B vC | k    |       |
            |       |           |          |      |       |
            | D-5 L |           | A#2 B v9 | k    |       | h v5
            |       |           |          |      |       |
            | D#5 L |           | A#1 B vC |      | s     |
            |       |           |          |      |       |
            | F-5 L |           | A#2 B v9 |      |       | h v5
            |       |           |          |      |       |
            | G-5 L | G-3 C a37 | G-1 B vC | k    |       |
            |       |           |          |      |       |
            |       |           | G-2 B v9 |      |       | h v5
            |       |           |          |      |       |
            |       |           | G-1 B vC |      | s     |
            |       |           |          |      |       |
            |       |           | G-2 B v9 |      |       | h v5
            |       |           |          |      |       |
            | D-5 L |           | G-1 B vC | k    |       |
            |       |           |          |      |       |
            |       |           | G-2 B v9 | k    |       | h v5
            |       |           |          |      |       |
            | A#4 L |           | G-1 B vC |      | s     |
            |       |           |          |      |       |
            |       |           | G-2 B v9 |      |       | h v5
            |       |           |          |      |       |
        `,
    },
    order: ['arps', 'verse', 'verse', 'arps', 'verse'],
    loop: 1,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const SETUP_COMPLETE: Tune = {
    name: 'Setup Complete',
    style: 'PC sound card',
    techniques: [
        'Two-operator FM, with the half-sine, abs-sine and quarter-sine operator waves of the era\'s cheaper FM chips',
        'Chords as fast arpeggios (a37, a47), stepping at 60 Hz, as the trackers played them',
        'An octave bass of two operators, feeding back',
        'A dry mix, as a sound card played it',
    ],
    song: SETUP_COMPLETE_SONG,
};

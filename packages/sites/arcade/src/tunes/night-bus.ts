import { createAudio90Song } from '@mvtjs/audio';
import { CRASH, HAT, PAD, REESE } from './instruments';
import { AAH, BREAKBEAT } from './sample-instruments';
import type { Tune } from './tune';

/** Jungle: an original break, bounced and sliced, replayed in a new order at 170 beats a minute, over a reese bass and a choir. */
export const NIGHT_BUS_SONG = createAudio90Song({
    bpm: 170,
    volume: 1.22,
    character: 'sampler',
    instruments: { b: BREAKBEAT, R: REESE, D: PAD, A: AAH, h: HAT, C: CRASH },
    reverb: { size: 0.7, decayMs: 2400, level: 0.35 },
    mixer: [
        {  },
        {  },
        { reverb: 0.3 },
        { pan: 0.2, reverb: 0.3 },
    ],
    patterns: {
        intro: `
            # break | reese | pad       | choir | hat | crash
            |       |       | D-4 D c37 | D-4 A |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           | F-4 A |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
            |       |       |           |       |     |
        `,
        roll: `
            # break | reese | pad       | choir | hat  | crash
            | b s00 | D-2 R | D-4 D c37 |       |      |
            | b s01 |       |           |       |      |
            | b s02 |       |           |       | h v4 |
            | b s03 |       |           |       |      |
            | b s04 |       |           |       |      |
            | b s05 |       |           |       |      |
            | b s06 |       |           |       | h v4 |
            | b s07 |       |           |       |      |
            | b s08 |       |           |       |      |
            | b s09 |       |           |       |      |
            | b s0A |       |           |       | h v4 |
            | b s0B |       |           |       |      |
            | b s0C |       |           |       |      |
            | b s0D |       |           |       |      |
            | b s0E |       |           |       | h v4 |
            | b s0F |       |           |       |      |
            | b s10 |       |           |       |      |
            | b s11 |       |           |       |      |
            | b s12 |       |           |       | h v4 |
            | b s13 |       |           |       |      |
            | b s14 |       |           |       |      |
            | b s15 |       |           |       |      |
            | b s16 |       |           |       | h v4 |
            | b s17 |       |           |       |      |
            | b s18 |       |           |       |      |
            | b s19 |       |           |       |      |
            | b s1A |       |           |       | h v4 |
            | b s1B |       |           |       |      |
            | b s1C |       |           |       |      |
            | b s1D |       |           |       |      |
            | b s1E |       |           |       | h v4 |
            | b s1F |       |           |       |      |
        `,
        chop: `
            # break | reese | pad       | choir | hat  | crash
            | b s00 | D-2 R | D-4 D c37 | D-4 A |      | C
            | b s01 |       |           |       |      |
            | b s04 |       |           |       | h v4 |
            | b s03 |       |           |       |      |
            | b s04 |       |           |       |      |
            | b s05 |       |           |       |      |
            | b s02 |       |           |       | h v4 |
            | b s07 |       |           |       |      |
            | b s08 |       |           |       |      |
            | b s09 |       |           |       |      |
            | b s0C |       |           |       | h v4 |
            | b s0B |       |           |       |      |
            | b s0C |       |           |       |      |
            | b s0D |       |           |       |      |
            | b s0E |       |           |       | h v4 |
            | b s0F |       |           |       |      |
            | b s10 |       |           | F-4 A |      |
            | b s11 |       |           |       |      |
            | b s14 |       |           |       | h v4 |
            | b s13 |       |           |       |      |
            | b s04 |       |           |       |      |
            | b s05 |       |           |       |      |
            | b s16 |       |           |       | h v4 |
            | b s07 |       |           |       |      |
            | b s18 |       |           |       |      |
            | b s19 |       |           |       |      |
            | b s18 |       |           |       | h v4 |
            | b s1B |       |           |       |      |
            | b s1C |       |           |       |      |
            | b s1D |       |           |       |      |
            | b s1E |       |           |       | h v4 |
            | b s1F |       |           |       |      |
        `,
    },
    order: ['intro', 'intro-4', 'roll', 'roll-4', 'chop-7', 'chop-5', 'roll', 'roll-4', 'chop-7', 'chop-5'],
    loop: 2,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const NIGHT_BUS: Tune = {
    name: 'Night Bus',
    style: 'Jungle',
    techniques: [
        'A break programmed from analog drums, bounced at 26 kHz and 12 bits, and cut into 32 slices',
        'The slices replayed in a new order with the s token, one a sixteenth',
        'A reese bass: two saws drifting against each other, with a sub an octave down',
        'A choir\'s "aah", bounced from a pulse through three band-pass filters',
        'The sampler character: each sample\'s own grit kept, with no smoothing',
    ],
    song: NIGHT_BUS_SONG,
};

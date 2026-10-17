import { createAudio90Song } from '@mvtjs/chiptune';
import { ACID, BOOM, CRASH, DIRTY_BASS, SIREN } from './instruments';
import { BREAKBEAT, HIT } from './sample-instruments';
import type { Tune } from './tune';

/** Big beat: the break cut up and slowed, a dirty bass riff, an acid line and the orchestra hit, at 127 beats a minute. */
export const FUSE_BOX_SONG = createAudio90Song({
    bpm: 127,
    volume: 1.45,
    character: 'sampler',
    instruments: { b: BREAKBEAT, k: BOOM, R: DIRTY_BASS, a: ACID, H: HIT, Z: SIREN, x: CRASH },
    reverb: { size: 0.5, decayMs: 1400, level: 0.3 },
    echo: { timeBeats: 0.75, feedback: 0.35, isPingPong: true, level: 0.3 },
    mixer: [
        {  },
        {  },
        {  },
        { pan: 0.3, echo: 0.3 },
        { reverb: 0.3 },
        { pan: -0.2 },
    ],
    patterns: {
        introA: `
            # break     | kick | riff | acid | stab | siren | crash
            | G-3 b s00 |      |      |      |      |       |
            | G-3 s01   |      |      |      |      |       |
            | G-3 s02   |      |      |      |      |       |
            | G-3 s03   |      |      |      |      |       |
            | G-3 s04   |      |      |      |      |       |
            | G-3 s05   |      |      |      |      |       |
            | G-3 s06   |      |      |      |      |       |
            | G-3 s07   |      |      |      |      |       |
            | G-3 s08   |      |      |      |      |       |
            | G-3 s09   |      |      |      |      |       |
            | G-3 s0A   |      |      |      |      |       |
            | G-3 s0B   |      |      |      |      |       |
            | G-3 s0C   |      |      |      |      |       |
            | G-3 s0D   |      |      |      |      |       |
            | G-3 s0E   |      |      |      |      |       |
            | G-3 s0F   |      |      |      |      |       |
        `,
        introB: `
            # break     | kick | riff | acid | stab | siren | crash
            | G-3 b s10 |      |      |      |      |       |
            | G-3 s11   |      |      |      |      |       |
            | G-3 s12   |      |      |      |      |       |
            | G-3 s13   |      |      |      |      |       |
            | G-3 s14   |      |      |      |      |       |
            | G-3 s15   |      |      |      |      |       |
            | G-3 s16   |      |      |      |      |       |
            | G-3 s17   |      |      |      |      |       |
            | G-3 s18   |      |      |      |      |       |
            | G-3 s19   |      |      |      |      |       |
            | G-3 s1A   |      |      |      |      |       |
            | G-3 s1B   |      |      |      |      |       |
            | G-3 s1C   |      |      |      |      |       |
            | G-3 s1D   |      |      |      |      |       |
            | G-3 s1E   |      |      |      |      |       |
            | G-3 s1F   |      |      |      |      |       |
        `,
        grooveA: `
            # break     | kick | riff  | acid | stab | siren | crash
            | G-3 b s00 |      | E-2 R |      |      |       |
            | G-3 s01   |      |       |      |      |       |
            | G-3 s02   |      | ===   |      |      |       |
            | G-3 s03   |      | E-2 R |      |      |       |
            | G-3 s04   |      | G-2 R |      |      |       |
            | G-3 s05   |      |       |      |      |       |
            | G-3 s06   |      | E-2 R |      |      |       |
            | G-3 s07   |      |       |      |      |       |
            | G-3 s08   |      | A-2 R |      |      |       |
            | G-3 s09   |      |       |      |      |       |
            | G-3 s0A   |      | A#2 R |      |      |       |
            | G-3 s0B   |      | B-2 R |      |      |       |
            | G-3 s0C   |      |       |      |      |       |
            | G-3 s0D   |      |       |      |      |       |
            | G-3 s0E   |      | D-3 R |      |      |       |
            | G-3 s0F   |      |       |      |      |       |
        `,
        grooveB: `
            # break     | kick | riff  | acid | stab | siren | crash
            | G-3 b s10 |      | E-2 R |      |      |       |
            | G-3 s11   |      |       |      |      |       |
            | G-3 s12   |      | ===   |      |      |       |
            | G-3 s13   |      | E-2 R |      |      |       |
            | G-3 s14   |      | G-2 R |      |      |       |
            | G-3 s15   |      |       |      |      |       |
            | G-3 s16   |      | E-2 R |      |      |       |
            | G-3 s17   |      |       |      |      |       |
            | G-3 s18   |      | A-2 R |      |      |       |
            | G-3 s19   |      |       |      |      |       |
            | G-3 s1A   |      | A#2 R |      |      |       |
            | G-3 s1B   |      | B-2 R |      |      |       |
            | G-3 s1C   |      |       |      |      |       |
            | G-3 s1D   |      |       |      |      |       |
            | G-3 s1E   |      | D-3 R |      |      |       |
            | G-3 s1F   |      |       |      |      |       |
        `,
        dropA: `
            # break     | kick | riff  | acid    | stab  | siren | crash
            | G-3 b s00 | k    | E-2 R | E-3 a ! | E-4 H |       | x
            | G-3 s01   |      |       |         |       |       |
            | G-3 s02   |      | ===   | E-3     |       |       |
            | G-3 s03   |      | E-2 R | E-4     |       |       |
            | G-3 s04   |      | G-2 R |         |       |       |
            | G-3 s05   |      |       | E-3 !   |       |       |
            | G-3 s06   |      | E-2 R | G-3     |       |       |
            | G-3 s07   |      |       |         |       |       |
            | G-3 s08   | k    | A-2 R | E-3 !   |       |       |
            | G-3 s09   |      |       |         |       |       |
            | G-3 s0A   |      | A#2 R | D-4     |       |       |
            | G-3 s0B   |      | B-2 R | E-3     |       |       |
            | G-3 s0C   |      |       |         |       |       |
            | G-3 s0D   |      |       | G-3 !   |       |       |
            | G-3 s0E   |      | D-3 R | A-3     |       |       |
            | G-3 s0F   |      |       |         |       |       |
        `,
        dropB: `
            # break     | kick | riff  | acid    | stab | siren | crash
            | G-3 b s10 | k    | E-2 R | E-3 a ! |      |       |
            | G-3 s11   |      |       |         |      |       |
            | G-3 s12   |      | ===   | E-3     |      |       |
            | G-3 s13   |      | E-2 R | E-4     |      |       |
            | G-3 s14   |      | G-2 R |         |      |       |
            | G-3 s15   |      |       | E-3 !   |      |       |
            | G-3 s16   |      | E-2 R | G-3     |      |       |
            | G-3 s17   |      |       |         |      |       |
            | G-3 s18   | k    | A-2 R | E-3 !   |      |       |
            | G-3 s19   |      |       |         |      |       |
            | G-3 s1A   |      | A#2 R | D-4     |      |       |
            | G-3 s1B   |      | B-2 R | E-3     |      |       |
            | G-3 s14   |      |       |         |      |       |
            | G-3 s10   |      |       | G-3 !   |      |       |
            | G-3 s14   |      | D-3 R | A-3     |      |       |
            | G-3 s10   |      |       |         |      |       |
        `,
        roll: `
            # break        | kick | riff | acid | stab  | siren | crash
            | G-3 b s04 v9 |      |      |      |       |       |
            |              |      |      |      |       |       |
            | G-3 s04 v9   |      |      |      |       |       |
            |              |      |      |      |       |       |
            | G-3 s04 v9   |      |      |      |       |       |
            |              |      |      |      |       |       |
            | G-3 s04 v9   |      |      |      |       |       |
            |              |      |      |      |       |       |
            | G-3 s04 vA   |      |      |      |       |       |
            | G-3 s04 vA   |      |      |      |       |       |
            | G-3 s04 vA   |      |      |      |       |       |
            | G-3 s04 vA   |      |      |      |       |       |
            | G-3 s04 vC   |      |      |      | E-4 H |       |
            | G-3 s04 vC   |      |      |      |       |       |
            | G-3 s04 vC   |      |      |      |       |       |
            | G-3 s04 vC   |      |      |      |       |       |
        `,
        drift: `
            # break | kick | riff  | acid | stab | siren | crash
            |       |      | E-2 R |      |      | B-4 Z |
            |       |      |       |      |      |       |
            |       |      | ===   |      |      |       |
            |       |      | E-2 R |      |      |       |
            |       |      | G-2 R |      |      |       |
            |       |      |       |      |      |       |
            |       |      | E-2 R |      |      |       |
            |       |      |       |      |      |       |
            |       |      | A-2 R |      |      |       |
            |       |      |       |      |      |       |
            |       |      | A#2 R |      |      |       |
            |       |      | B-2 R |      |      |       |
            |       |      |       |      |      |       |
            |       |      |       |      |      |       |
            |       |      | D-3 R |      |      |       |
            |       |      |       |      |      |       |
        `,
    },
    order: ['introA', 'introB', 'introA', 'introB', 'grooveA', 'grooveB', 'grooveA', 'grooveB', 'roll', 'dropA', 'dropB', 'dropA', 'dropB', 'drift', 'drift', 'drift', 'roll', 'dropA', 'dropB', 'dropA', 'dropB'],
    loop: 4,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const FUSE_BOX: Tune = {
    name: 'Fuse Box',
    style: 'Big beat',
    techniques: [
        'The jungle tune\'s break played five semitones down, so its slices fit 127 beats a minute',
        'The break\'s last beats chopped into repeats, and a snare roll from its own snare slice',
        'A riff of two saws driven hard into a resonant filter',
        'An acid line with accents, and the orchestra hit on the downbeats',
        'A siren for the breakdown: a pulse bent slowly up and down by an LFO',
    ],
    song: FUSE_BOX_SONG,
};

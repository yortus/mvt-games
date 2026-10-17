import { createAudio90Song } from '@mvtjs/audio';
import { ELECTRIC_PIANO, STRINGS, SUB_BASS } from './instruments';
import { BREAKBEAT } from './sample-instruments';
import type { Tune } from './tune';

/** Trip-hop: the break played an octave down, slowed and darkened as a sampler would, under electric piano and strings. */
export const SLOW_BURN_SONG = createAudio90Song({
    bpm: 84,
    swing: 0.12,
    volume: 0.85,
    character: 'sampler',
    instruments: { b: BREAKBEAT, u: SUB_BASS, E: ELECTRIC_PIANO, S: STRINGS },
    reverb: { size: 0.6, decayMs: 2200, damping: 0.6, level: 0.35 },
    echo: { timeBeats: 0.75, feedback: 0.45, toneHz: 2500, level: 0.35 },
    mixer: [
        {  },
        {  },
        { pan: -0.35, echo: 0.3 },
        { echo: 0.3 },
        { pan: 0.35, echo: 0.3 },
        { reverb: 0.3 },
    ],
    patterns: {
        sparse: `
            # break | bass  | keys     | keys     | keys     | strings
            |       | C-2 u | D#4 E vB | A#4 E vB | D-5 E vB | C-4 S c37 v8
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       | D#4 E v7 | A#4 E v7 | D-5 E v7 |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       | ===   |          |          |          |
            |       |       |          |          |          |
            |       | G#1 u | C-4 E vB | G-4 E vB | D#5 E vB | G#3 S c47 v8
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       | C-4 E v7 | G-4 E v7 | D#5 E v7 |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       | ===   |          |          |          |
            |       |       |          |          |          |
            |       | F-1 u | G#4 E vB | C-5 E vB | D#5 E vB | F-3 S c37 v8
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       | G#4 E v7 | C-5 E v7 | D#5 E v7 |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       | ===   |          |          |          |
            |       |       |          |          |          |
            |       | G-1 u | F-4 E vB | B-4 E vB | D-5 E vB | G-3 S c47 v8
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       | F-4 E v7 | B-4 E v7 | D-5 E v7 |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       |       |          |          |          |
            |       | ===   |          |          |          |
            |       |       |          |          |          |
        `,
        groove: `
            # break     | bass  | keys     | keys     | keys     | strings
            | C-3 b s00 | C-2 u | D#4 E vB | A#4 E vB | D-5 E vB | C-4 S c37 v8
            | C-3 b s01 |       |          |          |          |
            | C-3 b s02 |       |          |          |          |
            | C-3 b s03 |       |          |          |          |
            | C-3 b s04 |       |          |          |          |
            | C-3 b s05 |       |          |          |          |
            | C-3 b s06 |       |          |          |          |
            | C-3 b s07 |       |          |          |          |
            | C-3 b s08 |       |          |          |          |
            | C-3 b s09 |       |          |          |          |
            | C-3 b s0A |       | D#4 E v7 | A#4 E v7 | D-5 E v7 |
            | C-3 b s0B |       |          |          |          |
            | C-3 b s0C |       |          |          |          |
            | C-3 b s0D |       |          |          |          |
            | C-3 b s0E | ===   |          |          |          |
            | C-3 b s0F |       |          |          |          |
            | C-3 b s10 | G#1 u | C-4 E vB | G-4 E vB | D#5 E vB | G#3 S c47 v8
            | C-3 b s11 |       |          |          |          |
            | C-3 b s12 |       |          |          |          |
            | C-3 b s13 |       |          |          |          |
            | C-3 b s14 |       |          |          |          |
            | C-3 b s15 |       |          |          |          |
            | C-3 b s16 |       |          |          |          |
            | C-3 b s17 |       |          |          |          |
            | C-3 b s18 |       |          |          |          |
            | C-3 b s19 |       |          |          |          |
            | C-3 b s1A |       | C-4 E v7 | G-4 E v7 | D#5 E v7 |
            | C-3 b s1B |       |          |          |          |
            | C-3 b s1C |       |          |          |          |
            | C-3 b s1D |       |          |          |          |
            | C-3 b s1E | ===   |          |          |          |
            | C-3 b s1F |       |          |          |          |
            | C-3 b s00 | F-1 u | G#4 E vB | C-5 E vB | D#5 E vB | F-3 S c37 v8
            | C-3 b s01 |       |          |          |          |
            | C-3 b s02 |       |          |          |          |
            | C-3 b s03 |       |          |          |          |
            | C-3 b s04 |       |          |          |          |
            | C-3 b s05 |       |          |          |          |
            | C-3 b s06 |       |          |          |          |
            | C-3 b s07 |       |          |          |          |
            | C-3 b s08 |       |          |          |          |
            | C-3 b s09 |       |          |          |          |
            | C-3 b s0A |       | G#4 E v7 | C-5 E v7 | D#5 E v7 |
            | C-3 b s0B |       |          |          |          |
            | C-3 b s0C |       |          |          |          |
            | C-3 b s0D |       |          |          |          |
            | C-3 b s0E | ===   |          |          |          |
            | C-3 b s0F |       |          |          |          |
            | C-3 b s10 | G-1 u | F-4 E vB | B-4 E vB | D-5 E vB | G-3 S c47 v8
            | C-3 b s11 |       |          |          |          |
            | C-3 b s12 |       |          |          |          |
            | C-3 b s13 |       |          |          |          |
            | C-3 b s14 |       |          |          |          |
            | C-3 b s15 |       |          |          |          |
            | C-3 b s16 |       |          |          |          |
            | C-3 b s17 |       |          |          |          |
            | C-3 b s18 |       |          |          |          |
            | C-3 b s19 |       |          |          |          |
            | C-3 b s1A |       | F-4 E v7 | B-4 E v7 | D-5 E v7 |
            | C-3 b s1B |       |          |          |          |
            | C-3 b s14 |       |          |          |          |
            | C-3 b s15 |       |          |          |          |
            | C-3 b s1E | ===   |          |          |          |
            | C-3 b s1F |       |          |          |          |
        `,
    },
    order: ['sparse', 'groove', 'groove', 'sparse'],
    loop: 1,
});

/** The tune, as the demos list it, with the techniques it shows. */
export const SLOW_BURN: Tune = {
    name: 'Slow Burn',
    style: 'Trip-hop',
    techniques: [
        'The jungle tune\'s break played an octave down: half its speed and darker, the sound of pitched-down samples',
        'Each slice an octave down lasts a sixteenth at 84 beats a minute, so the break fits the slower tempo',
        'A sine sub bass, held',
        'A four-operator FM electric piano, chorused, through the echo',
        'The sampler character, and a heavy swing',
    ],
    song: SLOW_BURN_SONG,
};

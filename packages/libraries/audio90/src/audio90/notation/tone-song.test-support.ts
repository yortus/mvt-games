import { type Audio90Song, createAudio90Song } from './audio90-song';
import { createAudio90Sound } from './audio90-sound';

/** A song of one pure tone at `note`, held for `rows` rows. */
export function createToneSong(note: string, rows: number): Audio90Song {
    const sine = createAudio90Sound({ engine: 'fm', operators: [{}], envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 5 } });
    const pattern = [`| ${note} T`, ...new Array<string>(rows - 1).fill('| ...')].join('\n');
    return createAudio90Song({ bpm: 120, instruments: { T: sine }, patterns: { p: pattern }, order: ['p'] });
}

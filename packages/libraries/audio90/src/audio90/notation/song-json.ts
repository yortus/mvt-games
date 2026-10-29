import type { Audio90SampleOptions } from './audio90-sample';
import type { Audio90SongOptions } from './audio90-song';
import type { Audio90SoundOptions } from './audio90-sound';

// What a song's text holds, which `printAudio90Song` prints and
// `parseAudio90Song` reads: JSON, with a format and a version first.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A song as its text holds it: its options, with its sounds printed out and its patterns as rows. */
export type SongJson = Omit<Audio90SongOptions, 'instruments' | 'patterns'> & {
    readonly instruments: Readonly<Record<string, SoundJson>>;
    readonly patterns: Readonly<Record<string, Rows>>;
};

/** A sound as a song's text holds it: its options, with its sample printed out and its step table as rows. */
export type SoundJson = Omit<Audio90SoundOptions, 'sample' | 'steps'> & {
    readonly sample?: SampleJson;
    readonly steps?: Rows;
};

/** A sample as a song's text holds it: its options, with the song it bounces printed out. */
export type SampleJson = Omit<Audio90SampleOptions, 'bounce'> & {
    readonly bounce: SongJson;
};

/** A pattern or a step table, as a list of its rows, or as one string with a row on each line. */
export type Rows = readonly string[] | string;

/** The `format` a song's text starts with. */
export const SONG_FORMAT = 'audio90 song';

/** The `version` of a song's text that this package prints and reads. */
export const SONG_VERSION = 1;

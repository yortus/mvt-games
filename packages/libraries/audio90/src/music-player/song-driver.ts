import type { SongTiming } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the music player reads of any chip's song: its timing, its swing and its loop. */
export interface PlayableSong extends SongTiming {
    /** How late each odd-numbered row of a pattern plays, as a share of a row, from 0 to 0.5. */
    readonly swing: number;
    /** The index in `order` to go back to at the end, or -1 to play once. */
    readonly loop: number;
}

/**
 * What a chip's songs write, for the music player, which keeps their time.
 * The player calls each method during its update, with the chip time the
 * write is stamped with. The driver keeps the writes, and sends them to the
 * chip when the player's refresh calls `refresh`, since a view writes to its
 * chip only as it refreshes.
 */
export interface SongDriver<S extends PlayableSong> {
    /** The chip's clock, in ms. */
    readonly time: number;
    /** Writes `song`'s settings as it starts. Its first row follows. */
    start: (song: S, stamp: number, tempoScale: number) => void;
    /** Writes row `row` of order entry `orderIndex`, which lasts `lengthMs` of song time. */
    playRow: (song: S, orderIndex: number, row: number, stamp: number, lengthMs: number, tempoScale: number) => void;
    /** Writes what a new tempo scale changes, such as the channels' slides. */
    changeTempoScale: (song: S, stamp: number, tempoScale: number) => void;
    /** Releases every channel of `song`. */
    release: (song: S, stamp: number) => void;
    /** Gives the song's voices back to the sound effects, once no song plays. */
    finish: (stamp: number) => void;
    /** Sends the writes kept since the last refresh to the chip. */
    refresh: () => void;
}

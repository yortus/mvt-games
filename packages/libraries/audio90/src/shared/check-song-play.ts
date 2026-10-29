import { CELL_IS_OWN_NOTE, CELL_NOTE, type SongCore } from './notation';
import { HIGHEST_NOTE, LOWEST_NOTE } from './notes';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How a song plays, beside what it says itself. Either chip takes these. */
export interface SongPlayOptions {
    /**
     * How many more times the song's loop plays before the song ends. 0 plays
     * the song through to the end of its order once, and ends it there.
     * Defaults to `Infinity`, so a song that loops plays until it is stopped.
     * A song with no loop ends at the end of its order whatever this says.
     */
    readonly repeat?: number;
    /**
     * Semitones to play every note up (or, below 0, down), as an order entry
     * such as `'verse+5'` transposes its pattern. It may be a fraction: 0.5 is
     * a quarter tone, and a small fraction detunes the song, as an old tape
     * running fast would. An instrument's own note, as a drum plays, is not
     * moved. Defaults to 0.
     */
    readonly pitch?: number;
    /**
     * How long to fade the song in over, in ms, from silence, evenly in
     * decibels. The chip fades as a whole, sounds included. Defaults to 0,
     * which starts the song at full volume.
     */
    readonly fadeMs?: number;
    /**
     * Where to start, in ms of song time from its start, at its own tempo,
     * as `durationMs` and `positionMs` measure it. It suits a seek bar, or
     * music timed to a cutscene. A start that falls inside a row waits for
     * the next row to play. 0 or more, and less than `durationMs`. Defaults to
     * 0, the song's start.
     */
    readonly startMs?: number;
    /**
     * Where to start, as a place in the song's order: an entry, and a row of
     * that entry's pattern, which plays at once. It suits skipping to a
     * section, or resuming where the chip's `orderIndex` and `row` said the
     * song was. Give this or `startMs`, not both.
     */
    readonly startAt?: SongPlace;
}

/** A place in a song: an entry in its order, and a row of that entry's pattern, each counted from 0. */
export interface SongPlace {
    readonly orderIndex: number;
    readonly row: number;
}

/** What `checkSongPlay` reads of a song: its notes, through its order, and its length. */
export type CheckedSong = Pick<SongCore<unknown>, 'channelCount' | 'order' | 'patterns' | 'durationMs'>;

/**
 * A song play's options, checked, with their defaults filled in. A start
 * part way is either `startMs` above 0, or a `startOrderIndex` or `startRow`
 * above 0, never both.
 */
export interface CheckedSongPlay {
    readonly repeat: number;
    readonly pitch: number;
    readonly fadeMs: number;
    readonly startMs: number;
    readonly startOrderIndex: number;
    readonly startRow: number;
}

/** How a song plays when nothing says: from its start, looping until it is stopped, at its own pitch. */
export const DEFAULT_SONG_PLAY: CheckedSongPlay = Object.freeze({ repeat: Infinity, pitch: 0, fadeMs: 0, startMs: 0, startOrderIndex: 0, startRow: 0 });

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Checks `options` for a play of `song`, and fills in their defaults. Throws
 * if `repeat` is not a whole number, 0 or more, or `Infinity`; if `pitch` is
 * not a finite number; if `pitch` takes any of the song's notes outside the
 * chip's range; if `fadeMs` is not 0 or more and finite; or if the start is
 * not a place in the song, or is given both ways.
 */
export function checkSongPlay(song: CheckedSong, options: SongPlayOptions | undefined): CheckedSongPlay {
    if (options === undefined) return DEFAULT_SONG_PLAY;
    const repeat = options.repeat ?? Infinity;
    if (!(repeat === Infinity || (Number.isInteger(repeat) && repeat >= 0))) throw new Error(`play: repeat must be a whole number, 0 or more, or Infinity; got ${repeat}`);
    const pitch = options.pitch ?? 0;
    if (!Number.isFinite(pitch)) throw new Error(`play: pitch must be a finite number of semitones; got ${pitch}`);
    if (pitch !== 0) {
        const { lowest, highest } = findNoteRange(song);
        if (lowest + pitch < LOWEST_NOTE || highest + pitch > HIGHEST_NOTE) {
            throw new Error(`play: pitch ${pitch} takes the song's notes, ${lowest} to ${highest}, outside the chip's range (${LOWEST_NOTE} to ${HIGHEST_NOTE})`);
        }
    }
    const fadeMs = options.fadeMs ?? 0;
    if (!(Number.isFinite(fadeMs) && fadeMs >= 0)) throw new Error(`play: fadeMs must be 0 or more, and finite; got ${fadeMs}`);
    const { startMs = 0, startAt } = options;
    if (startAt !== undefined && options.startMs !== undefined) throw new Error('play: give startMs or startAt, not both');
    if (options.startMs !== undefined && !(startMs >= 0 && startMs < song.durationMs)) {
        throw new Error(`play: startMs must be 0 or more, and less than the song's ${song.durationMs} ms; got ${startMs}`);
    }
    if (startAt !== undefined) checkStartAt(song, startAt);
    return { repeat, pitch, fadeMs, startMs, startOrderIndex: startAt?.orderIndex ?? 0, startRow: startAt?.row ?? 0 };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Throws unless `place` is an entry of `song`'s order, and a row of that entry's pattern. */
function checkStartAt(song: CheckedSong, place: SongPlace): void {
    const { orderIndex, row } = place;
    if (!(Number.isInteger(orderIndex) && orderIndex >= 0 && orderIndex < song.order.length)) {
        throw new Error(`play: startAt.orderIndex must be an entry of the song's order, 0 to ${song.order.length - 1}; got ${orderIndex}`);
    }
    const rowCount = song.patterns[song.order[orderIndex].pattern].rowCount;
    if (!(Number.isInteger(row) && row >= 0 && row < rowCount)) {
        throw new Error(`play: startAt.row must be a row of entry ${orderIndex}'s pattern, 0 to ${rowCount - 1}; got ${row}`);
    }
}

/** Each song's lowest and highest note as its order plays them, found the first time a song is played with a pitch. */
const NOTE_RANGES = new WeakMap<object, { readonly lowest: number; readonly highest: number }>();

/**
 * The lowest and highest note `song` plays, each transposed by its order
 * entry. An instrument's own note is left out, since a pitch doesn't move
 * it. A song with no such note has a range of `Infinity` to `-Infinity`,
 * which no pitch takes out of range.
 */
function findNoteRange(song: CheckedSong): { readonly lowest: number; readonly highest: number } {
    const known = NOTE_RANGES.get(song);
    if (known !== undefined) return known;
    let lowest = Infinity;
    let highest = -Infinity;
    for (const entry of song.order) {
        const { rowCount, cells } = song.patterns[entry.pattern];
        // Each cell's numbers, which differ from chip to chip
        const stride = cells.length / (rowCount * song.channelCount);
        for (let at = 0; at < cells.length; at += stride) {
            const note = cells[at + CELL_NOTE];
            if (note < 0 || cells[at + CELL_IS_OWN_NOTE] === 1) continue;
            lowest = Math.min(lowest, note + entry.transpose);
            highest = Math.max(highest, note + entry.transpose);
        }
    }
    const range = { lowest, highest };
    NOTE_RANGES.set(song, range);
    return range;
}

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
     * such as `'verse+5'` transposes its pattern. An instrument's own note,
     * as a drum plays, is not moved. Defaults to 0.
     */
    readonly pitch?: number;
    /**
     * How long to fade the song in over, in ms, from silence, evenly in
     * decibels. The chip fades as a whole, sounds included. Defaults to 0,
     * which starts the song at full volume.
     */
    readonly fadeMs?: number;
}

/** What `checkSongPlay` reads of a song: its notes, through its order. */
export type CheckedSong = Pick<SongCore<unknown>, 'channelCount' | 'order' | 'patterns'>;

/** A song play's options, checked, with their defaults filled in. */
export interface CheckedSongPlay {
    readonly repeat: number;
    readonly pitch: number;
    readonly fadeMs: number;
}

/** How a song plays when nothing says: looping until it is stopped, at its own pitch. */
export const DEFAULT_SONG_PLAY: CheckedSongPlay = Object.freeze({ repeat: Infinity, pitch: 0, fadeMs: 0 });

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Checks `options` for a play of `song`, and fills in their defaults. Throws
 * if `repeat` is not a whole number, 0 or more, or `Infinity`; if `pitch` is
 * not a whole number; if `pitch` takes any of the song's notes outside the
 * chip's range; or if `fadeMs` is not 0 or more and finite.
 */
export function checkSongPlay(song: CheckedSong, options: SongPlayOptions | undefined): CheckedSongPlay {
    if (options === undefined) return DEFAULT_SONG_PLAY;
    const repeat = options.repeat ?? Infinity;
    if (!(repeat === Infinity || (Number.isInteger(repeat) && repeat >= 0))) throw new Error(`play: repeat must be a whole number, 0 or more, or Infinity; got ${repeat}`);
    const pitch = options.pitch ?? 0;
    if (!Number.isInteger(pitch)) throw new Error(`play: pitch must be a whole number of semitones; got ${pitch}`);
    if (pitch !== 0) {
        const { lowest, highest } = findNoteRange(song);
        if (lowest + pitch < LOWEST_NOTE || highest + pitch > HIGHEST_NOTE) {
            throw new Error(`play: pitch ${pitch} takes the song's notes, ${lowest} to ${highest}, outside the chip's range (${LOWEST_NOTE} to ${HIGHEST_NOTE})`);
        }
    }
    const fadeMs = options.fadeMs ?? 0;
    if (!(Number.isFinite(fadeMs) && fadeMs >= 0)) throw new Error(`play: fadeMs must be 0 or more, and finite; got ${fadeMs}`);
    return { repeat, pitch, fadeMs };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

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

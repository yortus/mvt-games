import type { SongOrderEntry } from './song-core';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What `computeSongDurationMs` reads of a song, as it is made. */
export interface SongTiming {
    readonly bpm: number;
    readonly rowsPerBeat: number;
    readonly order: readonly SongOrderEntry[];
    readonly patterns: readonly { readonly rowCount: number }[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** How long one pass through `song`'s order lasts, in ms, at its own tempo, for either chip's song. Swing does not change it. */
export function computeSongDurationMs(song: SongTiming): number {
    let rows = 0;
    for (let i = 0; i < song.order.length; i++) rows += song.patterns[song.order[i].pattern].rowCount;
    return rows * 60000 / (song.bpm * song.rowsPerBeat);
}

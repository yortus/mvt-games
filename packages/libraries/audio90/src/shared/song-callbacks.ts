// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a chip calls as its songs play, for a page that doesn't tick to poll
 * `row` and `song`. Each is given once, as the chip is made. `Song` is the
 * chip's song type.
 *
 * In a browser, each is called on the page as the audio thread reports the
 * row or the end, a moment before the listener hears it: by about the time
 * the sound takes to reach the speaker. On a headless chip, each is called
 * during `update`, for what the update played, in order, so a callback never
 * runs inside `play` or `stop`.
 */
export interface SongCallbacks<Song> {
    /**
     * Called as the song reaches each row, the first included, with the song
     * and where the row is: the entry in its order, and the row within that
     * entry's pattern.
     */
    readonly onRow?: (song: Song, orderIndex: number, row: number) => void;
    /**
     * Called as a song ends by itself: at the end of its order, with no repeat
     * of its loop left and no song queued. A song stopped with `stop`, or
     * followed by a song queued after it, doesn't end this way.
     */
    readonly onEnded?: (song: Song) => void;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One place on a chip's own sequencer, which plays one song at a time. A
 * music player plays through one. `S` is the chip's song type.
 *
 * The sequencer runs where the chip's sound is made. In a browser, that is
 * the audio thread, on the sound card's clock, so a late frame never holds the
 * music up. It still pauses with the game. A headless chip runs it on its own
 * clock, which the game loop advances.
 *
 * Each call takes effect at once on a headless chip, and as soon as the
 * audio thread hears of it in a browser. What the slot reports is what the
 * listener hears now: in a browser, it trails what was asked by the time the
 * sound takes to reach the speaker.
 */
export interface SongSlot<S> {
    /** The song heard playing, or undefined when none is. */
    readonly song: S | undefined;
    /** The entry in the song's order whose row is heard. 0 when no song is playing. */
    readonly orderIndex: number;
    /** The row heard, within the pattern of the entry at `orderIndex`. 0 when no song is playing. */
    readonly row: number;
    /** Where the song heard has got to, in beats from its start. 0 when no song is playing. */
    readonly beat: number;
    /** Starts `song` from its beginning, releasing any song playing, and cancels any song queued. */
    play: (song: S) => void;
    /** Plays `song` without a gap when the song playing reaches the end of its order, or at once if none is playing. */
    queue: (song: S) => void;
    /** Releases the song's notes, gives its voices back to effects, and stops. */
    stop: () => void;
    /** Sets the tempo scale, where 1 is the song's own tempo and 0 holds it where it is. */
    setTempoScale: (scale: number) => void;
}

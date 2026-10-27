import type { Audio80, Audio80Song } from '../audio80';
import type { Audio90, Audio90Song } from '../audio90';
import type { SongSlot } from '../shared';
import type { PlayableSong } from './song-driver';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Plays one song at a time, playing channel n on voice n, on either chip.
 * The code that owns it chooses what plays: which song, when it starts and
 * stops, and how fast. Each call goes to the chip as it is made.
 *
 * The song's place is kept where the sound is made, on the chip's own
 * sequencer. In a browser, that is the audio thread, on the sound card's
 * clock, so a late frame never holds the music up, and the music pauses as
 * the chip does. A headless chip moves it on as its clock moves, so the same
 * ticks always make the same notes.
 *
 * What the player reports, `orderIndex`, `row` and `beat`, is what the
 * listener hears now, so a view that shows the song, as a tracker does,
 * shows the row being heard. `S` is the song type of the chip it plays on,
 * `Audio80Song` or `Audio90Song`.
 */
export interface MusicPlayer<S extends PlayableSong> {
    /** The song playing, or undefined once it ends or is stopped. A song started, queued with none playing, or stopped shows here at once. */
    readonly song: S | undefined;
    /** Whether a song is playing. It is true while `song` is defined, even while a `tempoScale` of 0 holds it still. */
    readonly isPlaying: boolean;
    /** Where the song heard has got to, in beats from its start. Views can use it to move in time with the music. */
    readonly beat: number;
    /**
     * The entry in the song's order whose row is heard now. 0 when no song
     * is playing, and while a song just started has yet to reach the
     * speaker. A view that shows the song, as a tracker does, reads it with
     * `row`.
     */
    readonly orderIndex: number;
    /** The row heard now, within the pattern of the entry at `orderIndex`. 0 when no song is playing. */
    readonly row: number;
    /**
     * A multiplier on the song's tempo, where 1 plays it at its own tempo. 0
     * holds the song where it is. Its notes ring on as their envelopes allow,
     * and its slides stop. On the Audio90, the LFOs and the echo timed in
     * beats follow it too, and a scale of 0 holds those LFOs. This suits music
     * that plays only while something moves. A negative or non-finite value
     * acts as 0. A change goes to the chip at once. One made in the same
     * moment as `play`, before it or after it, applies from the song's start,
     * so the tempo can follow the song just chosen. Only a glide in the
     * song's first row keeps the tempo the song started at.
     */
    tempoScale: number;
    /**
     * Starts `song` from its beginning. It releases any song playing, and
     * cancels any song queued, so nothing queued before plays after it.
     */
    play: (song: S) => void;
    /**
     * Plays `song` without a gap when the song playing reaches the end of its
     * order, even if that song loops. If no song is playing, it plays `song`
     * at once.
     */
    queue: (song: S) => void;
    /** Releases the song's notes, gives its voices back to effects, and stops. */
    stop: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `createMusicPlayer` needs: the chip it plays on, named by its kind. */
export type MusicPlayerOptions = { readonly audio80: Audio80 } | { readonly audio90: Audio90 };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a music player for an Audio80, with no song playing. It opens a slot on the chip's sequencer. */
export function createMusicPlayer(options: { readonly audio80: Audio80 }): MusicPlayer<Audio80Song>;
/** Creates a music player for an Audio90, with no song playing. It opens a slot on the chip's sequencer. Each song tells the chip its tempo too. */
export function createMusicPlayer(options: { readonly audio90: Audio90 }): MusicPlayer<Audio90Song>;
export function createMusicPlayer(options: MusicPlayerOptions): MusicPlayer<Audio80Song> | MusicPlayer<Audio90Song> {
    if ('audio90' in options) return createPlayerOnSlot(options.audio90.openSongSlot());
    return createPlayerOnSlot(options.audio80.openSongSlot());
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Creates a music player that passes each call to `slot`, and sends a tempo only as it changes. */
function createPlayerOnSlot<S extends PlayableSong>(slot: SongSlot<S>): MusicPlayer<S> {
    let tempoScale = 1;

    return {
        get song() {
            return slot.song;
        },
        get isPlaying() {
            return slot.song !== undefined;
        },
        get beat() {
            return slot.beat;
        },
        get orderIndex() {
            return slot.orderIndex;
        },
        get row() {
            return slot.row;
        },
        get tempoScale() {
            return tempoScale;
        },
        set tempoScale(value) {
            const scale = Number.isFinite(value) && value > 0 ? value : 0;
            // A view may set it every refresh, so only a change is sent
            if (scale === tempoScale) return;
            tempoScale = scale;
            slot.setTempoScale(scale);
        },
        play: slot.play,
        queue: slot.queue,
        stop: slot.stop,
    };
}

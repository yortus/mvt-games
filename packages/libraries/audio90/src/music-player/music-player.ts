import type { Audio80, Audio80Song } from '../audio80';
import type { Audio90, Audio90Song } from '../audio90';
import type { SongSlot } from '../shared';
import type { PlayableSong } from './song-driver';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Plays one song at a time, playing channel n on voice n, on either chip. An
 * audio view owns one, and chooses what it plays: which song, when it starts
 * and stops, and its tempo. That choice is the view's presentation state.
 *
 * The song's place is kept where the sound is made, on the chip's own
 * sequencer. In a browser, that is the audio thread, on the sound card's
 * clock, so a late frame never holds the music up. The sequencer still
 * pauses with the game, and a headless chip runs it on the game's ticks, so
 * the same ticks still make the same notes.
 *
 * A view calls `play`, `queue` and `stop` from its update or refresh step,
 * and `refresh` at the end of its refresh step, which sends them to the chip.
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
     * acts as 0. A change is sent with the next `refresh`.
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
    /** Sends what was played, queued, stopped or changed since the last refresh to the chip. Call it from the view's refresh step. */
    refresh: () => void;
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

/** What a call waiting for `refresh` asks the slot to do. */
type SlotCall = 'play' | 'queue' | 'stop';

/** Creates a music player that sends its calls to `slot` as it refreshes. */
function createPlayerOnSlot<S extends PlayableSong>(slot: SongSlot<S>): MusicPlayer<S> {
    // The calls waiting for `refresh`, in order, and the song each names. They are rare, so a list is fine
    const calls: SlotCall[] = [];
    const songs: (S | undefined)[] = [];
    // Whether a waiting call changes the song playing, and the song it changes to. Until the calls are sent,
    // the player answers with what they ask for
    let isSongAsked = false;
    let asked: S | undefined;
    let tempoScale = 1;
    let sentScale = 1;

    const player: MusicPlayer<S> = {
        get song() {
            return isSongAsked ? asked : slot.song;
        },
        get isPlaying() {
            return player.song !== undefined;
        },
        get beat() {
            return isSongAsked ? 0 : slot.beat;
        },
        get orderIndex() {
            return isSongAsked ? 0 : slot.orderIndex;
        },
        get row() {
            return isSongAsked ? 0 : slot.row;
        },
        get tempoScale() {
            return tempoScale;
        },
        set tempoScale(value) {
            tempoScale = Number.isFinite(value) && value > 0 ? value : 0;
        },

        play(song) {
            ask('play', song);
            isSongAsked = true;
            asked = song;
        },

        queue(song) {
            // With nothing playing, a queued song starts at once
            if (!player.isPlaying) {
                isSongAsked = true;
                asked = song;
            }
            ask('queue', song);
        },

        stop() {
            ask('stop', undefined);
            isSongAsked = true;
            asked = undefined;
        },

        refresh() {
            // The tempo goes first, so a song started in the same tick starts at it
            if (tempoScale !== sentScale) {
                sentScale = tempoScale;
                slot.setTempoScale(tempoScale);
            }
            if (calls.length === 0) return;
            for (let i = 0; i < calls.length; i++) {
                const song = songs[i];
                const call = calls[i];
                if (call === 'stop') slot.stop();
                else if (song !== undefined && call === 'play') slot.play(song);
                else if (song !== undefined) slot.queue(song);
            }
            calls.length = 0;
            songs.length = 0;
            isSongAsked = false;
            asked = undefined;
        },
    };

    return player;

    function ask(call: SlotCall, song: S | undefined): void {
        calls.push(call);
        songs.push(song);
    }
}

import { type CheckedSongPlay, DEFAULT_SONG_PLAY, type PlayableSong, type SongCallbacks, type SongSequencer } from '../shared';
import type { SongCall, SongMessage, SongPlaceReply } from './worklet';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A browser chip's songs, on the page. Each call goes to the chip's
 * sequencer in the worklet, and each place the worklet reaches comes back,
 * with the frame it starts at. It reports the newest place that has reached
 * the speaker, so what it reports is what the listener hears.
 *
 * A call that changes the song raises the generation, and the page keeps
 * only the places of the latest generation. So a place of the song before,
 * still on its way, never shows against the song asked for. Until a place
 * of the song asked for reaches the speaker, it reports the song's start.
 *
 * It calls its callbacks as each place arrives, before the listener hears
 * it: for each new row of the song asked for, and as that song ends by
 * itself. A song stopped from the page changes the generation, so its end
 * calls nothing.
 */
export interface WebSongs<S extends PlayableSong> extends SongSequencer<S> {
    /** Takes a place the worklet sent. */
    receive: (reply: SongPlaceReply) => void;
    /** Forgets every song sent, and every place kept, as the worklet does as the chip resets. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WebSongsOptions<S extends PlayableSong> extends SongCallbacks<S> {
    /** Sends a message to the worklet. */
    readonly send: (message: SongMessage) => void;
    /**
     * Readies `song` to send, the first time it is played: defines its
     * instruments, and returns the ids they were given, with the song as it
     * travels to the worklet.
     */
    readonly prepare: (song: S) => { readonly song: object; readonly soundIds: readonly number[] };
    /** The audio context's frame reaching the speaker now, or undefined when it is not known. */
    readonly speakerFrame: () => number | undefined;
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a chip's songs, with no song sent and none playing. */
export function createWebSongs<S extends PlayableSong>(options: WebSongsOptions<S>): WebSongs<S> {
    const { send, prepare, speakerFrame, sampleRate, onRow, onEnded } = options;
    // The songs sent, both ways round
    const songIds = new Map<S, number>();
    const songs = new Map<number, S>();
    let nextSongId = 1;
    let generation = 0;
    // The song last asked for, which is reported until a place of it is heard
    let asked: S | undefined;
    let tempoScale = 1;
    // The places kept, round and round
    const places = new Float64Array(HISTORY * PLACE_FIELDS);
    let newest = -1;
    let count = 0;
    // The song and row of the place that arrived last in this generation, for the callbacks. A song id of 0 is
    // no song
    let arrivedSongId = 0;
    let arrivedOrderIndex = 0;
    let arrivedRow = 0;
    // Whether the page has stopped the song that arrived last, so its end is not one it came to by itself
    let isStopping = false;

    const webSongs: WebSongs<S> = {
        get song() {
            const at = findHeard();
            if (at < 0) return asked;
            return songs.get(places[at * PLACE_FIELDS + PLACE_SONG_ID]);
        },
        get orderIndex() {
            const at = findHeard();
            return at < 0 ? 0 : places[at * PLACE_FIELDS + PLACE_ORDER_INDEX];
        },
        get row() {
            const at = findHeard();
            return at < 0 ? 0 : places[at * PLACE_FIELDS + PLACE_ROW];
        },
        get beat() {
            return findHeardBeat();
        },
        play(song, play = DEFAULT_SONG_PLAY) {
            changeSong(song);
            call('play', song, play, 0);
        },
        queue(song, play = DEFAULT_SONG_PLAY) {
            // With nothing playing, a queued song starts at once, so it changes the song
            if (webSongs.song === undefined) changeSong(song);
            call('queue', song, play, 0);
        },
        stop(fadeMs = 0) {
            isStopping = true;
            if (fadeMs > 0) {
                // The song plays on as it fades, so it is still the song heard, and its places still count
                call('stop', undefined, { ...DEFAULT_SONG_PLAY, fadeMs }, 0);
                return;
            }
            changeSong(undefined);
            call('stop', undefined, DEFAULT_SONG_PLAY, 0);
        },
        get tempoScale() {
            return tempoScale;
        },
        set tempoScale(scale) {
            tempoScale = scale;
            call('tempo', undefined, DEFAULT_SONG_PLAY, scale);
        },

        receive(reply) {
            // A place sent before the worklet heard of the latest change of song is dropped
            if (reply.generation !== generation) return;
            newest = (newest + 1) % HISTORY;
            if (count < HISTORY) count++;
            const at = newest * PLACE_FIELDS;
            places[at + PLACE_FRAME] = reply.frame;
            places[at + PLACE_SONG_ID] = reply.songId;
            places[at + PLACE_ORDER_INDEX] = reply.orderIndex;
            places[at + PLACE_ROW] = reply.row;
            places[at + PLACE_BEAT] = reply.beat;
            places[at + PLACE_TEMPO_SCALE] = reply.tempoScale;
            tellCallbacks(reply);
        },

        reset() {
            songIds.clear();
            songs.clear();
            changeSong(undefined);
        },
    };
    return webSongs;

    /** Sends `which` to the sequencer, sending `song` first if it has not been sent. */
    function call(which: SongCall, song: S | undefined, play: CheckedSongPlay, value: number): void {
        let songId = 0;
        if (song !== undefined) {
            songId = songIds.get(song) ?? 0;
            if (songId === 0) {
                songId = nextSongId++;
                songIds.set(song, songId);
                songs.set(songId, song);
                const prepared = prepare(song);
                send({ kind: 'song', id: songId, song: prepared.song, soundIds: prepared.soundIds });
            }
        }
        send({ kind: 'song-call', generation, call: which, songId, repeat: play.repeat, pitch: play.pitch, fadeMs: play.fadeMs, value });
    }

    /**
     * Finds the newest place kept that has reached the speaker, or the
     * oldest kept if none has, or -1 if none is kept. With no speaker to
     * wait for, it is the newest.
     */
    function findHeard(): number {
        if (count === 0) return -1;
        const frame = speakerFrame();
        if (frame === undefined) return newest;
        let at = newest;
        for (let i = 0; i < count; i++) {
            at = (newest - i + HISTORY) % HISTORY;
            if (places[at * PLACE_FIELDS + PLACE_FRAME] <= frame) return at;
        }
        // None has reached the speaker yet, so the song asked for has yet to start
        return -1;
    }

    /** The beat heard now: the beat of the place heard, moved on by the time since it reached the speaker, at its tempo. */
    function findHeardBeat(): number {
        const at = findHeard();
        if (at < 0) return 0;
        const song = songs.get(places[at * PLACE_FIELDS + PLACE_SONG_ID]);
        if (song === undefined) return 0;
        const frame = speakerFrame() ?? places[at * PLACE_FIELDS + PLACE_FRAME];
        const sinceMs = Math.max(0, frame - places[at * PLACE_FIELDS + PLACE_FRAME]) * 1000 / sampleRate();
        return places[at * PLACE_FIELDS + PLACE_BEAT] + sinceMs * places[at * PLACE_FIELDS + PLACE_TEMPO_SCALE] * song.bpm / 60000;
    }

    /** Asks for `song`, or for none: a new generation, with no place of it heard yet. */
    function changeSong(song: S | undefined): void {
        generation++;
        asked = song;
        count = 0;
        if (song === undefined) return;
        arrivedSongId = 0;
        isStopping = false;
    }

    /** Calls `onRow` if the place that arrived is a new row, or `onEnded` if the song playing has ended by itself. */
    function tellCallbacks(reply: SongPlaceReply): void {
        const { songId, orderIndex, row } = reply;
        const before = arrivedSongId;
        if (songId === before && orderIndex === arrivedOrderIndex && row === arrivedRow) return;
        arrivedSongId = songId;
        arrivedOrderIndex = orderIndex;
        arrivedRow = row;
        if (songId === 0) {
            // No song now, in the generation a song was playing in, so it ran to its end, unless the page stopped it
            const ended = songs.get(before);
            if (ended !== undefined && !isStopping) onEnded?.(ended);
            return;
        }
        // A song queued behind one the page stopped is not stopped itself
        if (songId !== before) isStopping = false;
        const song = songs.get(songId);
        if (song !== undefined) onRow?.(song, orderIndex, row);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many places are kept. They cover far more than the speaker trails the worklet by. */
const HISTORY = 32;
/** Where each part of a place is in `places`. */
const PLACE_FRAME = 0;
const PLACE_SONG_ID = 1;
const PLACE_ORDER_INDEX = 2;
const PLACE_ROW = 3;
const PLACE_BEAT = 4;
const PLACE_TEMPO_SCALE = 5;
const PLACE_FIELDS = 6;

import type { PlayableSong } from '../music-player';
import type { SongSlot } from '../shared';
import type { SongCall, SongMessage, SongPlaceReply } from './song-messages';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A browser chip's song slots, on the page. Each call goes to the chip's
 * sequencer in the worklet, and each place the worklet reaches comes back,
 * with the frame it starts at. A slot reports the newest place that has
 * reached the speaker, so what it reports is what the listener hears.
 *
 * A call that changes the song raises the slot's generation, and the page
 * keeps only the places of its latest generation. So a place of the song
 * before, still on its way, never shows against the song asked for. Until a
 * place of the song asked for reaches the speaker, the slot reports its
 * start.
 */
export interface WebSongSlots<S extends PlayableSong> {
    /** Opens a slot, with no song playing. */
    open: () => SongSlot<S>;
    /** Takes a place the worklet sent. */
    receive: (reply: SongPlaceReply) => void;
    /** Forgets every song sent, and every place kept, as the worklet does as the chip resets. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WebSongSlotsOptions<S extends PlayableSong> {
    /** Sends a message to the worklet. */
    readonly send: (message: SongMessage) => void;
    /**
     * Readies `song` to send, the first time it is played: defines its
     * instruments, and returns the ids they were given, with the song as it
     * travels to the worklet.
     */
    readonly prepare: (song: S) => { readonly song: object; readonly instrumentIds: readonly number[] };
    /** The chip's time, in ms, which each call is stamped with. */
    readonly time: () => number;
    /** The audio context's frame reaching the speaker now, or undefined when it is not known. */
    readonly speakerFrame: () => number | undefined;
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a chip's song slots, with none open and no song sent. */
export function createWebSongSlots<S extends PlayableSong>(options: WebSongSlotsOptions<S>): WebSongSlots<S> {
    const { send, prepare, time, speakerFrame, sampleRate } = options;
    // The songs sent, both ways round
    const songIds = new Map<S, number>();
    const songs = new Map<number, S>();
    let nextSongId = 1;
    const slots: SlotState<S>[] = [];

    return {
        open() {
            const state = createSlotState<S>(slots.length + 1);
            slots.push(state);
            const slot: SongSlot<S> = {
                get song() {
                    const at = findHeard(state);
                    if (at < 0) return state.asked;
                    return songs.get(state.places[at * PLACE_FIELDS + PLACE_SONG_ID]);
                },
                get orderIndex() {
                    const at = findHeard(state);
                    return at < 0 ? 0 : state.places[at * PLACE_FIELDS + PLACE_ORDER_INDEX];
                },
                get row() {
                    const at = findHeard(state);
                    return at < 0 ? 0 : state.places[at * PLACE_FIELDS + PLACE_ROW];
                },
                get beat() {
                    return findHeardBeat(state);
                },
                play(song) {
                    changeSong(state, song);
                    call(state, 'play', song, 0);
                },
                queue(song) {
                    // With nothing playing, a queued song starts at once, so it changes the song
                    if (slot.song === undefined) changeSong(state, song);
                    call(state, 'queue', song, 0);
                },
                stop() {
                    changeSong(state, undefined);
                    call(state, 'stop', undefined, 0);
                },
                setTempoScale(scale) {
                    call(state, 'tempo', undefined, scale);
                },
            };
            return slot;
        },

        receive(reply) {
            const state = slots[reply.slot - 1];
            // A place sent before the worklet heard of the latest change of song is dropped
            if (state === undefined || reply.generation !== state.generation) return;
            state.newest = (state.newest + 1) % HISTORY;
            if (state.count < HISTORY) state.count++;
            const at = state.newest * PLACE_FIELDS;
            const { places } = state;
            places[at + PLACE_FRAME] = reply.frame;
            places[at + PLACE_SONG_ID] = reply.songId;
            places[at + PLACE_ORDER_INDEX] = reply.orderIndex;
            places[at + PLACE_ROW] = reply.row;
            places[at + PLACE_BEAT] = reply.beat;
            places[at + PLACE_TEMPO_SCALE] = reply.tempoScale;
        },

        reset() {
            songIds.clear();
            songs.clear();
            for (let i = 0; i < slots.length; i++) changeSong(slots[i], undefined);
        },
    };

    /** Sends `which` to `state`'s slot, sending `song` first if it has not been sent. */
    function call(state: SlotState<S>, which: SongCall, song: S | undefined, value: number): void {
        let songId = 0;
        if (song !== undefined) {
            songId = songIds.get(song) ?? 0;
            if (songId === 0) {
                songId = nextSongId++;
                songIds.set(song, songId);
                songs.set(songId, song);
                const prepared = prepare(song);
                send({ kind: 'song', id: songId, song: prepared.song, instrumentIds: prepared.instrumentIds });
            }
        }
        send({ kind: 'song-call', slot: state.slot, generation: state.generation, call: which, songId, value, stampMs: time() });
    }

    /**
     * Finds the newest place kept that has reached the speaker, or the
     * oldest kept if none has, or -1 if none is kept. With no speaker to
     * wait for, it is the newest.
     */
    function findHeard(state: SlotState<S>): number {
        if (state.count === 0) return -1;
        const frame = speakerFrame();
        if (frame === undefined) return state.newest;
        let at = state.newest;
        for (let i = 0; i < state.count; i++) {
            at = (state.newest - i + HISTORY) % HISTORY;
            if (state.places[at * PLACE_FIELDS + PLACE_FRAME] <= frame) return at;
        }
        // None has reached the speaker yet, so the song asked for has yet to start
        return -1;
    }

    /** The beat heard now: the beat of the place heard, moved on by the time since it reached the speaker, at its tempo. */
    function findHeardBeat(state: SlotState<S>): number {
        const at = findHeard(state);
        if (at < 0) return 0;
        const { places } = state;
        const song = songs.get(places[at * PLACE_FIELDS + PLACE_SONG_ID]);
        if (song === undefined) return 0;
        const frame = speakerFrame() ?? places[at * PLACE_FIELDS + PLACE_FRAME];
        const sinceMs = Math.max(0, frame - places[at * PLACE_FIELDS + PLACE_FRAME]) * 1000 / sampleRate();
        return places[at * PLACE_FIELDS + PLACE_BEAT] + sinceMs * places[at * PLACE_FIELDS + PLACE_TEMPO_SCALE] * song.bpm / 60000;
    }

    /** Asks `state`'s slot for `song`, or for none: a new generation, with no place of it heard yet. */
    function changeSong(state: SlotState<S>, song: S | undefined): void {
        state.generation++;
        state.asked = song;
        state.count = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What the page keeps of a slot: its number, its generation, the song last asked for, and the places kept, round and round. */
interface SlotState<S> {
    readonly slot: number;
    generation: number;
    asked: S | undefined;
    readonly places: Float64Array;
    newest: number;
    count: number;
}

function createSlotState<S>(slot: number): SlotState<S> {
    return { slot, generation: 0, asked: undefined, places: new Float64Array(HISTORY * PLACE_FIELDS), newest: -1, count: 0 };
}

/** How many places are kept for each slot. They cover far more than the speaker trails the worklet by. */
const HISTORY = 32;
/** Where each part of a place is in `places`. */
const PLACE_FRAME = 0;
const PLACE_SONG_ID = 1;
const PLACE_ORDER_INDEX = 2;
const PLACE_ROW = 3;
const PLACE_BEAT = 4;
const PLACE_TEMPO_SCALE = 5;
const PLACE_FIELDS = 6;

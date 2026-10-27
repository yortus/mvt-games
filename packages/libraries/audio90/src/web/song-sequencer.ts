import type { PlayableSong, SongPlayer } from '../music-player';
import { COMMAND_STRIDE, type CommandWriter } from '../shared';
import type { SongCallMessage, SongMessage, SongPlaceReply } from './song-messages';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A chip's sequencer, in its worklet. It plays songs on the sound card's
 * clock, so a late frame on the page never holds the music up. Each slot
 * plays one song at a time, through a song player on a writer and clock of
 * its own.
 *
 * Before each block the worklet renders, every slot moves on by the time the
 * block lasts, at the sound card's rate. Each write is then restamped with
 * the chip time of the sample it falls on, and queued with the page's
 * writes. So the songs move only in blocks the worklet renders, and stop
 * while the chip is paused.
 *
 * Calls from the page take effect at the start of the next block rendered.
 * A song started while the sound card could not play starts from its
 * beginning once it can.
 */
export interface WorkletSequencer {
    /** Takes a message from the page: a song to keep, or a call to a slot. */
    receive: (message: SongMessage) => void;
    /**
     * Moves every slot on by one block of `frames` samples, and queues what
     * they write with `enqueue`. The block covers chip time from `fromMs`,
     * each sample `msPerSample` after the one before, so each write is
     * stamped with the chip time of the sample it falls on. `frame` is the
     * audio context's frame the block starts at, which each place is sent
     * with.
     */
    advance: (frames: number, fromMs: number, msPerSample: number, frame: number, enqueue: (commands: Float64Array, count: number) => void) => void;
    /** Forgets every song and slot, with nothing playing, as the synthesiser forgets every instrument as it resets. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** A song the sequencer can play: a song of either chip, which names its instruments. */
export type SequencedSong = PlayableSong & { readonly instruments: readonly object[] };

export interface WorkletSequencerOptions<S extends SequencedSong, W extends CommandWriter> {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** Creates a writer for one slot's songs. It names each instrument by `idOf`, the id the page gave it. */
    readonly createWriter: (idOf: (instrument: object) => number | undefined) => W;
    /** Creates a song player that writes to `writer`. */
    readonly createPlayer: (writer: W) => SongPlayer<S>;
    /** Sends a slot's place to the page. It must copy the reply before it returns, as `postMessage` does, since the record is reused. */
    readonly sendPlace: (reply: SongPlaceReply) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a sequencer with no songs and no slots. */
export function createWorkletSequencer<S extends SequencedSong, W extends CommandWriter>(options: WorkletSequencerOptions<S, W>): WorkletSequencer {
    const { createWriter, createPlayer, sendPlace } = options;
    const msPerSample = 1000 / options.sampleRate;
    const songs = new Map<number, S>();
    const songIds = new Map<S, number>();
    // The id each song's instruments have on the page, which defined them
    const soundIds = new Map<object, number>();
    const idOf = (instrument: object) => soundIds.get(instrument);
    // The slots, in the order they were first called, and each by its number
    const slots: Slot<S, W>[] = [];
    const slotsByNumber = new Map<number, Slot<S, W>>();
    // The calls waiting for the next block
    const calls: SongCallMessage[] = [];
    // Reused for every place sent. Its fields are written, then it is copied as it is sent
    const reply = { kind: 'song-place' as const, slot: 0, generation: 0, frame: 0, songId: 0, orderIndex: 0, row: 0, beat: 0, tempoScale: 1 };

    return {
        receive(message) {
            if (message.kind === 'song-call') {
                calls.push(message);
                return;
            }
            const song = message.song as S;
            songs.set(message.id, song);
            songIds.set(song, message.id);
            for (let i = 0; i < song.instruments.length; i++) soundIds.set(song.instruments[i], message.soundIds[i]);
        },

        advance(frames, fromMs, chipMsPerSample, frame, enqueue) {
            for (let i = 0; i < calls.length; i++) apply(calls[i]);
            calls.length = 0;
            const blockMs = frames * msPerSample;
            for (let s = 0; s < slots.length; s++) {
                const slot = slots[s];
                const { writer, player } = slot;
                const musicFromMs = writer.time;
                writer.update(blockMs);
                player.update(blockMs);
                player.refresh();
                const count = writer.count;
                if (count > 0) {
                    // Each write is stamped on the slot's own clock. Restamp it with the chip time of the sample it
                    // falls on. While chip time stands still, every write falls at the block's start
                    const commands = writer.commands;
                    for (let i = 0; i < count; i++) {
                        const at = i * COMMAND_STRIDE + 1;
                        const stamp = commands[at];
                        if (stamp !== -Infinity) commands[at] = fromMs + (stamp - musicFromMs) / msPerSample * chipMsPerSample;
                    }
                    enqueue(commands, count);
                    writer.clear(commands);
                }
                sendIfMoved(slot, frame);
            }
        },

        reset() {
            for (let s = 0; s < slots.length; s++) {
                // The synthesiser is reset too, so the songs' releases are dropped rather than queued
                slots[s].player.stop();
                slots[s].player.refresh();
            }
            slots.length = 0;
            slotsByNumber.clear();
            calls.length = 0;
            songs.clear();
            songIds.clear();
            soundIds.clear();
        },
    };

    /** Applies one call from the page to its slot, at the start of the next block. */
    function apply(call: SongCallMessage): void {
        const slot = findSlot(call.slot);
        slot.generation = call.generation;
        slot.isMoved = true;
        const { player } = slot;
        if (call.call === 'tempo') {
            player.tempoScale = call.value;
            return;
        }
        if (call.call === 'stop') {
            player.stop();
            return;
        }
        const song = songs.get(call.songId);
        if (song === undefined) return;
        if (call.call === 'play') player.play(song);
        else player.queue(song);
    }

    /** Sends where `slot` is, if it has moved to a new row, started or stopped a song, or taken a call since it was last sent. */
    function sendIfMoved(slot: Slot<S, W>, frame: number): void {
        const { player } = slot;
        const song = player.song;
        const songId = song === undefined ? 0 : songIds.get(song) ?? 0;
        if (!slot.isMoved && songId === slot.sentSongId && player.orderIndex === slot.sentOrderIndex && player.row === slot.sentRow) return;
        slot.isMoved = false;
        slot.sentSongId = songId;
        slot.sentOrderIndex = player.orderIndex;
        slot.sentRow = player.row;
        reply.slot = slot.number;
        reply.generation = slot.generation;
        reply.frame = frame;
        reply.songId = songId;
        reply.orderIndex = player.orderIndex;
        reply.row = player.row;
        reply.beat = player.beat;
        reply.tempoScale = player.tempoScale;
        sendPlace(reply);
    }

    /** Returns slot `number`, making it the first time it is called. */
    function findSlot(number: number): Slot<S, W> {
        let slot = slotsByNumber.get(number);
        if (slot === undefined) {
            const writer = createWriter(idOf);
            slot = { number, writer, player: createPlayer(writer), generation: 0, isMoved: true, sentSongId: -1, sentOrderIndex: -1, sentRow: -1 };
            slots.push(slot);
            slotsByNumber.set(number, slot);
        }
        return slot;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One slot of the sequencer: its song player, the writer it plays on, and what was last sent of its place. */
interface Slot<S extends SequencedSong, W extends CommandWriter> {
    readonly number: number;
    readonly writer: W;
    readonly player: SongPlayer<S>;
    generation: number;
    /** Whether it has taken a call since its place was last sent, so its place is sent with the call's generation. */
    isMoved: boolean;
    sentSongId: number;
    sentOrderIndex: number;
    sentRow: number;
}

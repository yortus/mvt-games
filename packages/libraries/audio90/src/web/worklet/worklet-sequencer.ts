import { COMMAND_STRIDE, type CommandWriter, type PlayableSong, type SongPlayer } from '../../shared';
import type { SongCallMessage, SongMessage, SongPlaceReply } from './song-messages';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A chip's sequencer, in its worklet. It plays one song at a time on the
 * sound card's clock, so a late frame on the page never holds the music up.
 * It plays through a song player on a writer and clock of its own.
 *
 * Before each block the worklet renders, the song moves on by the time the
 * block lasts, at the sound card's rate. Each write is then restamped with
 * the chip time of the sample it falls on, and queued with the page's
 * writes. So the song moves only in blocks the worklet renders, and stops
 * while the chip is paused.
 *
 * Calls from the page take effect at the start of the next block rendered.
 * A song started while the sound card could not play starts from its
 * beginning once it can.
 */
export interface WorkletSequencer {
    /** Takes a message from the page: a song to keep, or a call. */
    receive: (message: SongMessage) => void;
    /**
     * Moves the song on by one block of `frames` samples, and queues what it
     * writes with `enqueue`. The block covers chip time from `fromMs`, each
     * sample `msPerSample` after the one before, so each write is stamped
     * with the chip time of the sample it falls on. `frame` is the audio
     * context's frame the block starts at, which each place is sent with.
     */
    advance: (frames: number, fromMs: number, msPerSample: number, frame: number, enqueue: (commands: Float64Array, count: number) => void) => void;
    /** Forgets every song, with nothing playing, as the synthesiser forgets every sound as it resets. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** A song the sequencer can play: a song of either chip, which names its instruments. */
export type SequencedSong = PlayableSong & { readonly instruments: readonly object[] };

/** What the sequencer needs of the writer its songs play on: its clock and the commands written. */
export type SequencerWriter = Pick<CommandWriter<never, never>, 'time' | 'update' | 'commands' | 'count' | 'clear'>;

export interface WorkletSequencerOptions<S extends SequencedSong, W extends SequencerWriter> {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** Creates the writer the songs play on. It names each instrument by `idOf`, the id the page gave it. */
    readonly createWriter: (idOf: (instrument: object) => number | undefined) => W;
    /** Creates a song player that writes to `writer`. */
    readonly createPlayer: (writer: W) => SongPlayer<S>;
    /** Sends the song's place to the page. It must copy the reply before it returns, as `postMessage` does, since the record is reused. */
    readonly sendPlace: (reply: SongPlaceReply) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a sequencer with no songs, and nothing playing. */
export function createWorkletSequencer<S extends SequencedSong, W extends SequencerWriter>(options: WorkletSequencerOptions<S, W>): WorkletSequencer {
    const { sendPlace } = options;
    const msPerSample = 1000 / options.sampleRate;
    const songs = new Map<number, S>();
    const songIds = new Map<S, number>();
    // The id each song's instruments have on the page, which defined them
    const soundIds = new Map<object, number>();
    const writer = options.createWriter((instrument) => soundIds.get(instrument));
    const player = options.createPlayer(writer);
    // The calls waiting for the next block
    const calls: SongCallMessage[] = [];
    // Reused for every place sent. Its fields are written, then it is copied as it is sent
    const reply = { kind: 'song-place' as const, generation: 0, frame: 0, songId: 0, orderIndex: 0, row: 0, beat: 0, tempoScale: 1 };
    // The generation of the last call applied, and what was last sent of the place. It starts as the page
    // starts, with no song, so nothing is sent until the first call
    const sent = { generation: 0, isMoved: false, songId: 0, orderIndex: 0, row: 0 };

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
            const musicFromMs = writer.time;
            writer.update(blockMs);
            player.update(blockMs);
            const count = writer.count;
            if (count > 0) {
                // Each write is stamped on the song's own clock. Restamp it with the chip time of the sample it
                // falls on. While chip time stands still, every write falls at the block's start
                const commands = writer.commands;
                for (let i = 0; i < count; i++) {
                    const at = i * COMMAND_STRIDE + 1;
                    const stamp = commands[at];
                    if (stamp !== -Infinity) commands[at] = fromMs + (stamp - musicFromMs) / msPerSample * chipMsPerSample;
                }
                enqueue(commands, count);
                writer.clear();
            }
            sendIfMoved(frame);
        },

        reset() {
            // The synthesiser is reset too, so the song's releases are dropped rather than queued
            player.stop();
            writer.clear();
            calls.length = 0;
            songs.clear();
            songIds.clear();
            soundIds.clear();
        },
    };

    /** Applies one call from the page, at the start of the next block. */
    function apply(call: SongCallMessage): void {
        sent.generation = call.generation;
        sent.isMoved = true;
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

    /** Sends where the song is, if it has moved to a new row, started or stopped, or taken a call since it was last sent. */
    function sendIfMoved(frame: number): void {
        const song = player.song;
        const songId = song === undefined ? 0 : songIds.get(song) ?? 0;
        if (!sent.isMoved && songId === sent.songId && player.orderIndex === sent.orderIndex && player.row === sent.row) return;
        sent.isMoved = false;
        sent.songId = songId;
        sent.orderIndex = player.orderIndex;
        sent.row = player.row;
        reply.generation = sent.generation;
        reply.frame = frame;
        reply.songId = songId;
        reply.orderIndex = player.orderIndex;
        reply.row = player.row;
        reply.beat = player.beat;
        reply.tempoScale = player.tempoScale;
        sendPlace(reply);
    }
}

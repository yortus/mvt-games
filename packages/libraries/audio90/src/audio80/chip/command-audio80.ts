import { ASAP_STAMP, type CommandWriter, createCommandBuffer, NO_GLIDE, toPlayLength, toPlayNote, toPlayVolume } from '../../shared';
import {
    ECHO_SETTING_INDEX,
    FILTER_SETTING_INDEX,
    type Audio80FilterMode,
    type SoundData,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_PLAY,
    OP_PLAY_OPTIONS,
    OP_RELEASE_ALL,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_VOICE,
    OP_STOP,
    toFilterModeFlags,
    toWaveFlags,
    VOICE_COUNT,
    VOICE_SETTING_INDEX,
    type Audio80Wave,
} from '../synthesiser';
import type { Audio80Sound } from '../notation';
import type { Audio80PlayOptions, Audio80Writer } from './audio80';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio80 that turns each call into a command for the synthesiser to play.
 * A command is a few numbers, stamped with the time it applies at. The writer
 * appends each command to a `Float64Array`, so writing allocates nothing.
 *
 * The first time a sound is played, the writer gives it an id. It passes the
 * sound to `onSound`, so the caller can send it to the synthesiser
 * before the commands that use it. Each play gets an id of its own, counted
 * up from 1, which `stop` takes.
 */
export interface CommandAudio80 extends Audio80Writer, CommandWriter {
    /** Plays `sound` as the chip's `play` does, and returns the play's id. */
    play: (sound: Audio80Sound, options?: Audio80PlayOptions) => number;
    /** Releases the note of the play with id `id`, as the chip's `stop` does. */
    stop: (id: number) => void;
    /** Takes the next play's id, for a play the writer doesn't write itself, such as a song's. */
    takePlayId: () => number;
    /**
     * Returns the id of `sound`'s commands, defining it if it has not been
     * played since the last `forget`. A song sent to the worklet names its
     * instruments by these ids.
     */
    defineSound: (sound: Audio80Sound) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an Audio80 that writes commands. */
export interface CommandAudio80Options {
    /**
     * Called the first time a sound is played since the last `forget`. It
     * receives the id that the sound's commands use.
     */
    readonly onSound: (id: number, data: SoundData) => void;
    /** How many commands a batch holds before it grows. Defaults to 256. */
    readonly capacity?: number;
    /**
     * Whether the writer has a clock of its own, which stamps each write made
     * with no `atMs`. Defaults to true. A browser's chip has none, since its
     * time is the sound card's: each write it is given with no `atMs` plays as
     * soon as it arrives.
     */
    readonly hasClock?: boolean;
    /** Called as a command is written into an empty batch, so the code that sends the batches knows there is one to send. */
    readonly onFirstWrite?: () => void;
    /**
     * Gives the id of a sound defined elsewhere, or undefined for one this
     * writer must define. A writer in the worklet uses it for the sounds the
     * page has already defined, so that the two writers' ids never clash.
     */
    readonly idOf?: (sound: Audio80Sound) => number | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio80 that turns each call into a command for the synthesiser.
 * Its clock starts at 0, or it has none if `hasClock` is false, and nothing
 * has been written yet.
 */
export function createCommandAudio80(options: CommandAudio80Options): CommandAudio80 {
    const { onSound, idOf } = options;
    const buffer = createCommandBuffer({ capacity: options.capacity, onFirstWrite: options.onFirstWrite });
    const write = buffer.write;
    // The clock, in a typed array: V8 boxes a double kept in a closure variable each time it is written, and this is written every tick
    const clock = new Float64Array(1);
    // With no clock, each write with no `atMs` is stamped as soon as possible, and `update` leaves it so
    if (options.hasClock === false) clock[0] = ASAP_STAMP;
    let nextId = 1;
    let nextPlayId = 1;
    const soundIds = new Map<Audio80Sound, number>();

    const writer: CommandAudio80 = {
        get time() {
            return clock[0];
        },
        voiceCount: VOICE_COUNT,
        get commands() {
            return buffer.commands;
        },
        get count() {
            return buffer.count;
        },

        update(deltaMs) {
            clock[0] += deltaMs;
        },

        play(sound, playOptions) {
            const { data } = sound;
            const note = playOptions?.note === undefined ? data.note : toPlayNote(playOptions.note, 'play: note');
            const glideTo = playOptions?.glideTo === undefined ? data.glideTo : toPlayNote(playOptions.glideTo, 'play: glideTo');
            const lengthMs = toPlayLength(playOptions?.lengthMs ?? data.lengthMs);
            const volume = toPlayVolume(playOptions?.volume ?? 1);
            const id = nextPlayId++;
            write(OP_PLAY_OPTIONS, ASAP_STAMP, lengthMs, Number.isNaN(glideTo) ? NO_GLIDE : glideTo, 0, 0);
            write(OP_PLAY, ASAP_STAMP, ensureSoundId(sound), id, note, volume);
            return id;
        },
        stop(id) {
            write(OP_STOP, ASAP_STAMP, id, 0, 0, 0);
        },
        noteOn(voice, sound, note, volume, atMs) {
            write(OP_NOTE_ON, atMs ?? clock[0], voice, ensureSoundId(sound), note, volume);
        },
        noteOff(voice, atMs) {
            write(OP_NOTE_OFF, atMs ?? clock[0], voice, 0, 0, 0);
        },
        setVoice(voice, setting, value, atMs) {
            const number = setting === 'wave' ? toWaveFlags(value as Audio80Wave) : value as number;
            write(OP_SET_VOICE, atMs ?? clock[0], voice, VOICE_SETTING_INDEX[setting], number, 0);
        },
        setFilter(filter, setting, value, atMs) {
            const number = setting === 'mode' ? toFilterModeFlags(value as Audio80FilterMode) : value as number;
            write(OP_SET_FILTER, atMs ?? clock[0], filter === 'a' ? 0 : 1, FILTER_SETTING_INDEX[setting], number, 0);
        },
        setEcho(setting, value, atMs) {
            write(OP_SET_ECHO, atMs ?? clock[0], ECHO_SETTING_INDEX[setting], value, 0, 0);
        },
        releaseAll() {
            write(OP_RELEASE_ALL, clock[0], 0, 0, 0, 0);
        },

        clear: buffer.clear,

        defineSound: (sound) => ensureSoundId(sound),

        takePlayId: () => nextPlayId++,

        forget() {
            soundIds.clear();
        },

    };

    return writer;

    function ensureSoundId(sound: Audio80Sound): number {
        const known = idOf?.(sound);
        if (known !== undefined) return known;
        let id = soundIds.get(sound);
        if (id === undefined) {
            id = nextId++;
            soundIds.set(sound, id);
            onSound(id, sound.data);
        }
        return id;
    }
}

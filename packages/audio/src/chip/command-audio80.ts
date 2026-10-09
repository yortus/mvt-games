import {
    COMMAND_STRIDE,
    ECHO_SETTING_INDEX,
    type EffectData,
    FILTER_SETTING_INDEX,
    type FilterMode,
    type InstrumentData,
    type MixBus,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_PLAY_EFFECT,
    OP_RELEASE_ALL,
    OP_RESERVE_VOICES,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_MIX,
    OP_SET_VOICE,
    toFilterModeFlags,
    toWaveFlags,
    VOICE_COUNT,
    VOICE_SETTING_INDEX,
    type Wave,
} from '../core';
import type { Instrument, SoundEffect } from '../notation';
import type { Audio80 } from './audio80';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio80 that turns each call into a command for the synthesiser to play.
 * A command is a few numbers, stamped with the time it applies at. The writer
 * appends each command to a `Float64Array`, so writing allocates nothing.
 *
 * The first time an instrument or effect is played, the writer gives it an
 * id. It passes the instrument or effect to `onInstrument` or `onEffect`, so
 * the caller can send it to the synthesiser before the commands that use it.
 */
export interface CommandAudio80 extends Audio80 {
    /** Advances `time` by `deltaMs`, in ms. */
    update: (deltaMs: number) => void;
    /**
     * The commands written since the last `clear`. Only the first `count` are
     * in use. Each command takes `COMMAND_STRIDE` numbers.
     */
    readonly commands: Float64Array;
    /** How many commands have been written since the last `clear`. */
    readonly count: number;
    /**
     * Starts the next batch of commands. If `buffer` is given and big enough,
     * the batch reuses it. If not, the writer makes a new array. Passing back
     * an array that was sent earlier avoids allocating a new one.
     *
     * The batch just sent may have been transferred to another thread. That
     * empties its array, whose length then reads 0. The writer never reads it
     * again.
     */
    clear: (buffer?: Float64Array) => void;
    /** Forgets every id. Each instrument and effect is then passed on again the next time it is played. */
    forget: () => void;
    /**
     * Sets a bus's gain, from 0 to 2. It applies as soon as it arrives, not at
     * a stamped time. It is for the listener's volume settings, not a song's.
     */
    setMix: (bus: MixBus, gain: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an Audio80 that writes commands. */
export interface CommandAudio80Options {
    /**
     * Called the first time an instrument is played since the last `forget`.
     * It receives the id that the instrument's commands use.
     */
    readonly onInstrument: (id: number, data: InstrumentData) => void;
    /**
     * Called the first time an effect is played since the last `forget`. It
     * receives the id that the effect's commands use.
     */
    readonly onEffect: (id: number, data: EffectData) => void;
    /** How many commands a batch holds before it grows. Defaults to 256. */
    readonly capacity?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio80 that turns each call into a command for the synthesiser.
 * Its clock starts at 0, and nothing has been written yet.
 */
export function createCommandAudio80(options: CommandAudio80Options): CommandAudio80 {
    const { onInstrument, onEffect } = options;
    // A batch's size in numbers, kept apart from the buffer's: a buffer sent
    // to another thread is detached, and its length reads 0
    let size = Math.max(1, options.capacity ?? DEFAULT_CAPACITY) * COMMAND_STRIDE;
    let commands: Float64Array = new Float64Array(size);
    let count = 0;
    let time = 0;
    let nextId = 1;
    const instrumentIds = new Map<Instrument, number>();
    const effectIds = new Map<SoundEffect, number>();

    const writer: CommandAudio80 = {
        get time() {
            return time;
        },
        voiceCount: VOICE_COUNT,
        get commands() {
            return commands;
        },
        get count() {
            return count;
        },

        update(deltaMs) {
            time += deltaMs;
        },

        play(effect) {
            write(OP_PLAY_EFFECT, ASAP, ensureEffectId(effect), 0, 0, 0);
        },
        noteOn(voice, instrument, note, volume, atMs) {
            write(OP_NOTE_ON, atMs ?? time, voice, ensureInstrumentId(instrument), note, volume);
        },
        noteOff(voice, atMs) {
            write(OP_NOTE_OFF, atMs ?? time, voice, 0, 0, 0);
        },
        setVoice(voice, setting, value, atMs) {
            const number = setting === 'wave' ? toWaveFlags(value as Wave) : value as number;
            write(OP_SET_VOICE, atMs ?? time, voice, VOICE_SETTING_INDEX[setting], number, 0);
        },
        setFilter(filter, setting, value, atMs) {
            const number = setting === 'mode' ? toFilterModeFlags(value as FilterMode) : value as number;
            write(OP_SET_FILTER, atMs ?? time, filter === 'a' ? 0 : 1, FILTER_SETTING_INDEX[setting], number, 0);
        },
        setEcho(setting, value, atMs) {
            write(OP_SET_ECHO, atMs ?? time, ECHO_SETTING_INDEX[setting], value, 0, 0);
        },
        reserveVoices(voices, atMs) {
            write(OP_RESERVE_VOICES, atMs ?? time, voices, 0, 0, 0);
        },
        releaseAll() {
            write(OP_RELEASE_ALL, time, 0, 0, 0, 0);
        },

        clear(buffer) {
            commands = buffer !== undefined && buffer.length >= size ? buffer : new Float64Array(size);
            count = 0;
        },

        forget() {
            instrumentIds.clear();
            effectIds.clear();
        },

        setMix(bus, gain) {
            write(OP_SET_MIX, ASAP, bus === 'music' ? 0 : 1, gain, 0, 0);
        },
    };

    return writer;

    function write(op: number, stamp: number, a: number, b: number, c: number, d: number): void {
        if ((count + 1) * COMMAND_STRIDE > commands.length) {
            size = Math.max(size, commands.length) * 2;
            const grown = new Float64Array(size);
            grown.set(commands.subarray(0, count * COMMAND_STRIDE));
            commands = grown;
        }
        const at = count * COMMAND_STRIDE;
        commands[at] = op;
        commands[at + 1] = stamp;
        commands[at + 2] = a;
        commands[at + 3] = b;
        commands[at + 4] = c;
        commands[at + 5] = d;
        count++;
    }

    function ensureInstrumentId(instrument: Instrument): number {
        let id = instrumentIds.get(instrument);
        if (id === undefined) {
            id = nextId++;
            instrumentIds.set(instrument, id);
            onInstrument(id, instrument.data);
        }
        return id;
    }

    function ensureEffectId(effect: SoundEffect): number {
        let id = effectIds.get(effect);
        if (id === undefined) {
            id = nextId++;
            effectIds.set(effect, id);
            onEffect(id, effect.data);
        }
        return id;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_CAPACITY = 256;
/** The stamp of a write played as soon as it arrives. */
const ASAP = -Infinity;

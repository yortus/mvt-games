import { ASAP_STAMP, type CommandWriter, createCommandBuffer, MIX_BUS_INDEX } from '../../shared';
import {
    ECHO_SETTING_INDEX,
    type EffectData,
    FILTER_SETTING_INDEX,
    type Audio80FilterMode,
    type InstrumentData,
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
    type Audio80Wave,
} from '../synthesiser';
import type { Audio80Instrument, Audio80SoundEffect } from '../notation';
import type { Audio80Writer } from './audio80';

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
export interface CommandAudio80 extends Audio80Writer, CommandWriter {
    /**
     * Returns the id of `instrument`'s commands, defining it if it has not
     * been played since the last `forget`. A song sent to the worklet names
     * its instruments by these ids.
     */
    defineInstrument: (instrument: Audio80Instrument) => number;
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
    /**
     * Gives the id of an instrument defined elsewhere, or undefined for one
     * this writer must define. A writer in the worklet uses it for the
     * instruments the page has already defined, so that the two writers'
     * ids never clash.
     */
    readonly idOf?: (instrument: Audio80Instrument) => number | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio80 that turns each call into a command for the synthesiser.
 * Its clock starts at 0, and nothing has been written yet.
 */
export function createCommandAudio80(options: CommandAudio80Options): CommandAudio80 {
    const { onInstrument, onEffect, idOf } = options;
    const buffer = createCommandBuffer({ capacity: options.capacity });
    const write = buffer.write;
    // The clock, in a typed array: V8 boxes a double kept in a closure variable each time it is written, and this is written every tick
    const clock = new Float64Array(1);
    let nextId = 1;
    const instrumentIds = new Map<Audio80Instrument, number>();
    const effectIds = new Map<Audio80SoundEffect, number>();

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

        play(effect) {
            write(OP_PLAY_EFFECT, ASAP_STAMP, ensureEffectId(effect), 0, 0, 0);
        },
        noteOn(voice, instrument, note, volume, atMs) {
            write(OP_NOTE_ON, atMs ?? clock[0], voice, ensureInstrumentId(instrument), note, volume);
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
        reserveVoices(voices, atMs) {
            write(OP_RESERVE_VOICES, atMs ?? clock[0], voices, 0, 0, 0);
        },
        releaseAll() {
            write(OP_RELEASE_ALL, clock[0], 0, 0, 0, 0);
        },

        clear: buffer.clear,

        defineInstrument: (instrument) => ensureInstrumentId(instrument),

        forget() {
            instrumentIds.clear();
            effectIds.clear();
        },

        setMix(bus, gain) {
            write(OP_SET_MIX, ASAP_STAMP, MIX_BUS_INDEX[bus], gain, 0, 0);
        },
    };

    return writer;

    function ensureInstrumentId(instrument: Audio80Instrument): number {
        const known = idOf?.(instrument);
        if (known !== undefined) return known;
        let id = instrumentIds.get(instrument);
        if (id === undefined) {
            id = nextId++;
            instrumentIds.set(instrument, id);
            onInstrument(id, instrument.data);
        }
        return id;
    }

    function ensureEffectId(effect: Audio80SoundEffect): number {
        let id = effectIds.get(effect);
        if (id === undefined) {
            id = nextId++;
            effectIds.set(effect, id);
            onEffect(id, effect.data);
        }
        return id;
    }
}

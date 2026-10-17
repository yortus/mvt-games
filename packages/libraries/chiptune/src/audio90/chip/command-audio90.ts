import { ASAP_STAMP, type CommandWriter, createCommandBuffer, MIX_BUS_INDEX } from '../../shared';
import {
    AUDIO90_CHARACTERS,
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_COUNT,
    AUDIO90_VOICE_SETTING_INDEX,
    type Audio90EffectData,
    type Audio90EffectId,
    type Audio90InstrumentData,
    type Audio90SampleData,
    OP90_NOTE_OFF,
    OP90_NOTE_ON,
    OP90_PLAY_EFFECT,
    OP90_RELEASE_ALL,
    OP90_RESERVE_VOICES,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_MIX,
    OP90_SET_TEMPO,
    OP90_SET_VOICE,
} from '../synthesiser';
import type { Audio90Instrument, Audio90Sample, Audio90SoundEffect } from '../notation';
import type { Audio90Writer } from './audio90';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio90 that turns each call into a command for the synthesiser to play.
 * A command is a few numbers, stamped with the time it applies at. The writer
 * appends each command to a `Float64Array`, so writing allocates nothing.
 *
 * The first time an instrument, effect or sample is played, the writer gives
 * it an id. It passes it to `onInstrument`, `onEffect` or `onSample`, so the
 * caller can send it to the synthesiser before the commands that use it. A
 * sample goes first, then the instrument or effect that plays it, with the
 * sample's id in its data.
 */
export interface CommandAudio90 extends Audio90Writer, CommandWriter {}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an Audio90 that writes commands. */
export interface CommandAudio90Options {
    /** Called the first time an instrument is played since the last `forget`, with the id its commands use. */
    readonly onInstrument: (id: number, data: Audio90InstrumentData) => void;
    /** Called the first time an effect is played since the last `forget`, with the id its commands use. */
    readonly onEffect: (id: number, data: Audio90EffectData) => void;
    /** Called the first time a sample is played since the last `forget`, with the id its instruments use. */
    readonly onSample: (id: number, data: Audio90SampleData) => void;
    /** How many commands a batch holds before it grows. Defaults to 256. */
    readonly capacity?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio90 that turns each call into a command for the synthesiser.
 * Its clock starts at 0, and nothing has been written yet.
 */
export function createCommandAudio90(options: CommandAudio90Options): CommandAudio90 {
    const { onInstrument, onEffect, onSample } = options;
    const buffer = createCommandBuffer({ capacity: options.capacity });
    const write = buffer.write;
    // The clock, in a typed array: V8 boxes a double kept in a closure variable each time it is written, and this is written every tick
    const clock = new Float64Array(1);
    let nextId = 1;
    const instrumentIds = new Map<Audio90Instrument, number>();
    const effectIds = new Map<Audio90SoundEffect, number>();
    const sampleIds = new Map<Audio90Sample, number>();

    const writer: CommandAudio90 = {
        get time() {
            return clock[0];
        },
        voiceCount: AUDIO90_VOICE_COUNT,
        get commands() {
            return buffer.commands;
        },
        get count() {
            return buffer.count;
        },

        update(deltaMs) {
            clock[0] += deltaMs;
        },

        play(effect, pan) {
            write(OP90_PLAY_EFFECT, ASAP_STAMP, ensureEffectId(effect), pan ?? 0, pan === undefined ? 0 : 1, 0);
        },
        noteOn(voice, instrument, note, volume, atMs) {
            write(OP90_NOTE_ON, atMs ?? clock[0], voice, ensureInstrumentId(instrument), note, volume);
        },
        noteOff(voice, atMs) {
            write(OP90_NOTE_OFF, atMs ?? clock[0], voice, 0, 0, 0);
        },
        setVoice(voice, setting, value, atMs) {
            write(OP90_SET_VOICE, atMs ?? clock[0], voice, AUDIO90_VOICE_SETTING_INDEX[setting], value, 0);
        },
        setEffect(effect, setting, value, atMs) {
            // Each effect's settings are their own record. TypeScript can't follow `effect` into it, so it is widened
            const settings: Readonly<Record<string, number>> = AUDIO90_EFFECT_SETTING_INDEX[effect as Audio90EffectId];
            write(OP90_SET_EFFECT, atMs ?? clock[0], AUDIO90_EFFECT_INDEX[effect], settings[setting], value, 0);
        },
        setCharacter(character, atMs) {
            write(OP90_SET_CHARACTER, atMs ?? clock[0], AUDIO90_CHARACTERS.indexOf(character), 0, 0, 0);
        },
        setTempo(bpm, atMs) {
            write(OP90_SET_TEMPO, atMs ?? clock[0], bpm, 0, 0, 0);
        },
        reserveVoices(voices, atMs) {
            write(OP90_RESERVE_VOICES, atMs ?? clock[0], voices, 0, 0, 0);
        },
        releaseAll() {
            write(OP90_RELEASE_ALL, clock[0], 0, 0, 0, 0);
        },

        clear: buffer.clear,

        forget() {
            instrumentIds.clear();
            effectIds.clear();
            sampleIds.clear();
        },

        setMix(bus, gain) {
            write(OP90_SET_MIX, ASAP_STAMP, MIX_BUS_INDEX[bus], gain, 0, 0);
        },
    };

    return writer;

    function ensureInstrumentId(instrument: Audio90Instrument): number {
        let id = instrumentIds.get(instrument);
        if (id === undefined) {
            const data = withSample(instrument.data, instrument.sample);
            id = nextId++;
            instrumentIds.set(instrument, id);
            onInstrument(id, data);
        }
        return id;
    }

    function ensureEffectId(effect: Audio90SoundEffect): number {
        let id = effectIds.get(effect);
        if (id === undefined) {
            const instrument = withSample(effect.data.instrument, effect.instrument.sample);
            const data = instrument === effect.data.instrument ? effect.data : { ...effect.data, instrument };
            id = nextId++;
            effectIds.set(effect, id);
            onEffect(id, data);
        }
        return id;
    }

    /** Returns `data` with the id of `sample`, which it sends first if it is new. With no sample, returns `data` itself. */
    function withSample(data: Audio90InstrumentData, sample: Audio90Sample | undefined): Audio90InstrumentData {
        if (sample === undefined) return data;
        let id = sampleIds.get(sample);
        if (id === undefined) {
            id = nextId++;
            sampleIds.set(sample, id);
            onSample(id, sample.data);
        }
        return data.sample === id ? data : { ...data, sample: id };
    }
}

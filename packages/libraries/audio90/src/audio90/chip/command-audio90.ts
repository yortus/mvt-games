import { ASAP_STAMP, type CommandWriter, createCommandBuffer, MIX_BUS_INDEX, NO_GLIDE, toPlayLength, toPlayNote, toPlayVolume } from '../../shared';
import {
    AUDIO90_CHARACTERS,
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_COUNT,
    AUDIO90_VOICE_SETTING_INDEX,
    type Audio90EffectId,
    type Audio90SoundData,
    type Audio90SampleData,
    OP90_NOTE_OFF,
    OP90_NOTE_ON,
    OP90_PLAY,
    OP90_PLAY_OPTIONS,
    OP90_RELEASE_ALL,
    OP90_RESERVE_VOICES,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_MIX,
    OP90_SET_TEMPO,
    OP90_SET_VOICE,
    OP90_STOP,
} from '../synthesiser';
import type { Audio90Sample, Audio90Sound } from '../notation';
import type { Audio90, Audio90Writer } from './audio90';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio90 that turns each call into a command for the synthesiser to play.
 * A command is a few numbers, stamped with the time it applies at. The writer
 * appends each command to a `Float64Array`, so writing allocates nothing.
 *
 * The first time a sound or sample is played, the writer gives it an id. It
 * passes it to `onSound` or `onSample`, so the caller can send it to the
 * synthesiser before the commands that use it. A sample goes first, then the
 * sound that plays it, with the sample's id in its data. Each play gets an id
 * of its own, counted up from 1, which `stop` takes.
 */
export interface CommandAudio90 extends Audio90Writer, Pick<Audio90, 'play' | 'stop'>, CommandWriter {
    /**
     * Returns the id of `sound`'s commands, defining it, and its sample, if
     * it has not been played since the last `forget`. A song sent to the
     * worklet names its instruments by these ids.
     */
    defineSound: (sound: Audio90Sound) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an Audio90 that writes commands. */
export interface CommandAudio90Options {
    /** Called the first time a sound is played since the last `forget`, with the id its commands use. */
    readonly onSound: (id: number, data: Audio90SoundData) => void;
    /** Called the first time a sample is played since the last `forget`, with the id its sounds use. */
    readonly onSample: (id: number, data: Audio90SampleData) => void;
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
    readonly idOf?: (sound: Audio90Sound) => number | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio90 that turns each call into a command for the synthesiser.
 * Its clock starts at 0, or it has none if `hasClock` is false, and nothing
 * has been written yet.
 */
export function createCommandAudio90(options: CommandAudio90Options): CommandAudio90 {
    const { onSound, onSample, idOf } = options;
    const buffer = createCommandBuffer({ capacity: options.capacity, onFirstWrite: options.onFirstWrite });
    const write = buffer.write;
    // The clock, in a typed array: V8 boxes a double kept in a closure variable each time it is written, and this is written every tick
    const clock = new Float64Array(1);
    // With no clock, each write with no `atMs` is stamped as soon as possible, and `update` leaves it so
    if (options.hasClock === false) clock[0] = ASAP_STAMP;
    let nextId = 1;
    let nextPlayId = 1;
    const soundIds = new Map<Audio90Sound, number>();
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

        play(sound, playOptions) {
            const { data } = sound;
            const note = playOptions?.note === undefined ? data.note : toPlayNote(playOptions.note, 'play: note');
            const glideTo = playOptions?.glideTo === undefined ? data.glideTo : toPlayNote(playOptions.glideTo, 'play: glideTo');
            const lengthMs = toPlayLength(playOptions?.lengthMs ?? data.lengthMs);
            const volume = toPlayVolume(playOptions?.volume ?? 1);
            const pan = playOptions?.pan;
            const id = nextPlayId++;
            write(OP90_PLAY_OPTIONS, ASAP_STAMP, lengthMs, Number.isNaN(glideTo) ? NO_GLIDE : glideTo, pan ?? 0, pan === undefined ? 0 : 1);
            write(OP90_PLAY, ASAP_STAMP, ensureSoundId(sound), id, note, volume);
            return id;
        },
        stop(id) {
            write(OP90_STOP, ASAP_STAMP, id, 0, 0, 0);
        },
        noteOn(voice, sound, note, volume, atMs) {
            write(OP90_NOTE_ON, atMs ?? clock[0], voice, ensureSoundId(sound), note, volume);
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

        defineSound: (sound) => ensureSoundId(sound),

        forget() {
            soundIds.clear();
            sampleIds.clear();
        },

        setMix(bus, gain) {
            write(OP90_SET_MIX, ASAP_STAMP, MIX_BUS_INDEX[bus], gain, 0, 0);
        },
    };

    return writer;

    function ensureSoundId(sound: Audio90Sound): number {
        const known = idOf?.(sound);
        if (known !== undefined) return known;
        let id = soundIds.get(sound);
        if (id === undefined) {
            const data = withSample(sound.data, sound.sample);
            id = nextId++;
            soundIds.set(sound, id);
            onSound(id, data);
        }
        return id;
    }

    /** Returns `data` with the id of `sample`, which it sends first if it is new. With no sample, returns `data` itself. */
    function withSample(data: Audio90SoundData, sample: Audio90Sample | undefined): Audio90SoundData {
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

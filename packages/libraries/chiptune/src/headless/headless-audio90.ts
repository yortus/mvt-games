import {
    type Audio90,
    type Audio90Character,
    type Audio90EffectId,
    type Audio90EffectSetting,
    type Audio90Instrument,
    type Audio90SoundEffect,
    AUDIO90_SCOPE_LENGTH,
    AUDIO90_VOICE_COUNT,
    type Audio90VoiceSetting,
    type Audio90WithControls,
    createAudio90Synthesiser,
    createCommandAudio90,
} from '../audio90';
import { createRenderedControls, createSilentControls, ignore } from './headless-controls';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio90 with no speaker, and its controls. A game run headless uses
 * one, for example to make thumbnails or run benchmarks. Tests and tools use
 * one too. What it does with each write depends on the options it was made
 * with, as for the headless Audio80:
 *
 * - With no options, it does nothing. Writes cost almost nothing. The clock
 *   still runs, so code that stamps writes behaves as usual.
 * - With `record: true`, it logs every write. Its `audio90` then has `log`
 *   and `clear`.
 * - With `render`, it plays every write in memory, in stereo. The object
 *   returned then has `render` and `sampleRate`, beside `audio90` and
 *   `controls`.
 * - With both, it logs every write and plays it.
 *
 * The type includes `log` and `clear` only when `record: true` is given, and
 * `render` and `sampleRate` only when `render` is given.
 */
export type HeadlessAudio90<O extends HeadlessAudio90Options = HeadlessAudio90Options> =
    & Audio90WithControls<O extends { readonly record: true } ? Audio90 & Audio90Log : Audio90>
    & (O extends { readonly render: true | HeadlessAudio90RenderOptions } ? Audio90Renderer : unknown);

/**
 * The log on a headless Audio90 made with `record: true`. A test advances its
 * clock through the controls made alongside it, as a game loop would.
 */
export interface Audio90Log {
    /** Every write since the last `clear`, oldest first. */
    readonly log: readonly Audio90Write[];
    /** Empties the log. */
    clear: () => void;
}

/**
 * One write to an Audio90, with the stamp it was given and its value as
 * written. An effect is stamped `-Infinity`, because it plays as soon as it
 * arrives. Its `pan` is undefined when it plays at the effect's own pan.
 */
export type Audio90Write =
    | { readonly kind: 'play'; readonly effect: Audio90SoundEffect; readonly pan: number | undefined; readonly time: number }
    | { readonly kind: 'note-on'; readonly voice: number; readonly instrument: Audio90Instrument; readonly note: number; readonly volume: number; readonly time: number }
    | { readonly kind: 'note-off'; readonly voice: number; readonly time: number }
    | { readonly kind: 'set-voice'; readonly voice: number; readonly setting: Audio90VoiceSetting; readonly value: number; readonly time: number }
    | Audio90EffectWrite
    | { readonly kind: 'set-character'; readonly character: Audio90Character; readonly time: number }
    | { readonly kind: 'set-tempo'; readonly bpm: number; readonly time: number }
    | { readonly kind: 'reserve-voices'; readonly count: number; readonly time: number }
    | { readonly kind: 'release-all'; readonly time: number };

/** A write to one of an effect's settings, whose setting is one of that effect's. */
export type Audio90EffectWrite = {
    readonly [E in Audio90EffectId]: { readonly kind: 'set-effect'; readonly effect: E; readonly setting: Audio90EffectSetting<E>; readonly value: number; readonly time: number };
}[Audio90EffectId];

/**
 * What a headless Audio90 made with `render` adds. It plays every write
 * exactly at its stamp. Advance its clock with `AudioControls.update`, then
 * `render` the samples up to it. Its volumes apply to the samples `render`
 * writes. `AudioControls.flush` does nothing, since `render` takes the writes
 * itself.
 */
export interface Audio90Renderer {
    /** The sample rate it renders at, in Hz. */
    readonly sampleRate: number;
    /**
     * Renders the next `left.length` samples into `left` and `right`, the two
     * channels, from where the last render ended, and plays the writes made
     * since. `right` must be at least as long as `left`. Each sample is -1 to
     * 1, or beyond for a mix turned up past 1. It allocates nothing, so a
     * caller can render block after block into the same buffers.
     */
    render: (left: Float32Array, right: Float32Array) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a headless Audio90. With neither option, it plays nothing and logs nothing. */
export interface HeadlessAudio90Options {
    /** Whether to log every write, on the chip's `log`. Defaults to false. */
    readonly record?: boolean;
    /** Whether to render, and how. `true` renders with the default options. Defaults to false, which renders nothing. */
    readonly render?: boolean | HeadlessAudio90RenderOptions;
}

/** How a headless Audio90 renders. */
export interface HeadlessAudio90RenderOptions {
    /** The sample rate to render at, in Hz. Defaults to 48,000. */
    readonly sampleRate?: number;
    /** How the chip sounds until a song sets it. Defaults to `'studio'`. */
    readonly character?: Audio90Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a headless Audio90 and its controls, with its clock at 0 and
 * nothing logged or rendered. Only what the options ask for is built. With
 * neither option, writes are empty functions and there is no synthesis.
 */
export function createHeadlessAudio90<const O extends HeadlessAudio90Options = HeadlessAudio90Options>(options?: O): HeadlessAudio90<O> {
    const record = options?.record === true;
    const render = options?.render ?? false;
    let chip: Audio90WithControls;
    if (render !== false) chip = createRenderingChip({ ...(render === true ? {} : render), record });
    else if (record) chip = createRecordingChip();
    else chip = createSilentChip();
    return chip as HeadlessAudio90<O>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_SAMPLE_RATE = 48000;

/** Creates a chip that plays nothing and logs nothing. Every write is an empty function. */
function createSilentChip(): Audio90WithControls {
    // In a typed array, so advancing it boxes no double
    const clock = new Float64Array(1);
    const audio90: Audio90 = {
        get time() {
            return clock[0];
        },
        get heardTime() {
            return clock[0];
        },
        voiceCount: AUDIO90_VOICE_COUNT,
        play: ignore,
        noteOn: ignore,
        noteOff: ignore,
        setVoice: ignore,
        setEffect: ignore,
        setCharacter: ignore,
        setTempo: ignore,
        reserveVoices: ignore,
        releaseAll: ignore,
        // It plays nothing, so its scope stays silent
        scope: new Float32Array(AUDIO90_SCOPE_LENGTH),
        setScopes: ignore,
    };
    const controls = createSilentControls({
        update(deltaMs) {
            clock[0] += deltaMs;
        },
    });
    return { audio90, controls };
}

/** Creates a chip that logs every write and plays nothing. */
function createRecordingChip(): Audio90WithControls<Audio90 & Audio90Log> {
    const clock = { time: 0 };
    const audio90 = createRecorder(clock);
    const controls = createSilentControls({
        update(deltaMs) {
            clock.time += deltaMs;
        },
    });
    return { audio90, controls };
}

/** Creates a chip that plays every write in memory, and also logs it if `record` is true. */
function createRenderingChip(options: HeadlessAudio90RenderOptions & { readonly record: boolean }): Audio90WithControls & Audio90Renderer {
    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const msPerSample = 1000 / sampleRate;
    const synthesiser = createAudio90Synthesiser({ sampleRate, character: options.character });
    const writer = createCommandAudio90({
        onInstrument: (id, data) => synthesiser.defineInstrument(id, data),
        onEffect: (id, data) => synthesiser.defineEffect(id, data),
        // A sample too big for what is left of sample memory is dropped, as the worklet drops it
        onSample: (id, data) => synthesiser.defineSample(id, data),
    });
    let renderedFrames = 0;

    // The synthesiser writes the scope as it renders, while scopes are on
    const scope = new Float32Array(AUDIO90_SCOPE_LENGTH);
    const audio90 = options.record ? createRecordingWriter() : createWriter();
    const controls = createRenderedControls({
        writer,
        synthesiser: {
            reset() {
                // A reset turns the scopes off, as the browser's chip's does
                synthesiser.reset();
                setScopes(false);
            },
            setMix: synthesiser.setMix,
        },
    });

    return {
        audio90,
        controls,
        sampleRate,
        render(left, right) {
            synthesiser.enqueue(writer.commands, writer.count);
            // Pass the same buffer back, so the writer reuses it rather than making a new one
            writer.clear(writer.commands);
            const frames = left.length;
            synthesiser.render(left, right, 0, frames, renderedFrames * msPerSample, msPerSample);
            renderedFrames += frames;
            const gain = controls.isMuted ? 0 : controls.volume;
            if (gain !== 1) {
                for (let i = 0; i < frames; i++) {
                    left[i] *= gain;
                    right[i] *= gain;
                }
            }
        },
    };

    /** Creates the chip for when only `render` is given: the writer with only the Audio90's members. */
    function createWriter(): Audio90 {
        return {
            get time() {
                return writer.time;
            },
            get heardTime() {
                return writer.time;
            },
            voiceCount: writer.voiceCount,
            play: writer.play,
            noteOn: writer.noteOn,
            noteOff: writer.noteOff,
            setVoice: writer.setVoice,
            setEffect: writer.setEffect,
            setCharacter: writer.setCharacter,
            setTempo: writer.setTempo,
            reserveVoices: writer.reserveVoices,
            releaseAll: writer.releaseAll,
            scope,
            setScopes,
        };
    }

    /** Creates the chip for when both `record` and `render` are given. Each write is logged, then passed to the writer. */
    function createRecordingWriter(): Audio90 & Audio90Log {
        const recorder = createRecorder(writer);
        return {
            get time() {
                return writer.time;
            },
            get heardTime() {
                return writer.time;
            },
            voiceCount: writer.voiceCount,
            log: recorder.log,
            clear: recorder.clear,
            play(effect, pan) {
                recorder.play(effect, pan);
                writer.play(effect, pan);
            },
            noteOn(voice, instrument, note, noteVolume, atMs) {
                recorder.noteOn(voice, instrument, note, noteVolume, atMs);
                writer.noteOn(voice, instrument, note, noteVolume, atMs);
            },
            noteOff(voice, atMs) {
                recorder.noteOff(voice, atMs);
                writer.noteOff(voice, atMs);
            },
            setVoice(voice, setting, value, atMs) {
                recorder.setVoice(voice, setting, value, atMs);
                writer.setVoice(voice, setting, value, atMs);
            },
            setEffect(effect, setting, value, atMs) {
                recorder.setEffect(effect, setting, value, atMs);
                writer.setEffect(effect, setting, value, atMs);
            },
            setCharacter(character, atMs) {
                recorder.setCharacter(character, atMs);
                writer.setCharacter(character, atMs);
            },
            setTempo(bpm, atMs) {
                recorder.setTempo(bpm, atMs);
                writer.setTempo(bpm, atMs);
            },
            reserveVoices(count, atMs) {
                recorder.reserveVoices(count, atMs);
                writer.reserveVoices(count, atMs);
            },
            releaseAll() {
                recorder.releaseAll();
                writer.releaseAll();
            },
            scope,
            setScopes,
        };
    }

    function setScopes(isOn: boolean): void {
        synthesiser.scope = isOn ? scope : undefined;
        if (!isOn) scope.fill(0);
    }
}

/** Creates an Audio90 that logs every write and plays nothing. A write with no stamp is stamped with `clock`'s time. */
function createRecorder(clock: { readonly time: number }): Audio90 & Audio90Log {
    const log: Audio90Write[] = [];
    return {
        get time() {
            return clock.time;
        },
        get heardTime() {
            return clock.time;
        },
        voiceCount: AUDIO90_VOICE_COUNT,
        log,
        clear() {
            log.length = 0;
        },
        play(effect, pan) {
            log.push({ kind: 'play', effect, pan, time: -Infinity });
        },
        noteOn(voice, instrument, note, volume, atMs) {
            log.push({ kind: 'note-on', voice, instrument, note, volume, time: atMs ?? clock.time });
        },
        noteOff(voice, atMs) {
            log.push({ kind: 'note-off', voice, time: atMs ?? clock.time });
        },
        setVoice(voice, setting, value, atMs) {
            log.push({ kind: 'set-voice', voice, setting, value, time: atMs ?? clock.time });
        },
        setEffect(effect, setting, value, atMs) {
            // The signature makes sure the effect and its setting agree. TypeScript can't follow that
            // into the union, so the write is cast
            log.push({ kind: 'set-effect', effect, setting, value, time: atMs ?? clock.time } as Audio90EffectWrite);
        },
        setCharacter(character, atMs) {
            log.push({ kind: 'set-character', character, time: atMs ?? clock.time });
        },
        setTempo(bpm, atMs) {
            log.push({ kind: 'set-tempo', bpm, time: atMs ?? clock.time });
        },
        reserveVoices(count, atMs) {
            log.push({ kind: 'reserve-voices', count, time: atMs ?? clock.time });
        },
        releaseAll() {
            log.push({ kind: 'release-all', time: clock.time });
        },
        // It plays nothing, so its scope stays silent
        scope: new Float32Array(AUDIO90_SCOPE_LENGTH),
        setScopes: ignore,
    };
}

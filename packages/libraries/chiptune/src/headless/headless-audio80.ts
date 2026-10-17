import {
    type Audio80,
    type Audio80WithControls,
    type Audio80Character,
    createAudio80Synthesiser,
    createCommandAudio80,
    type Audio80EchoSetting,
    type Audio80FilterId,
    type Audio80FilterMode,
    type Audio80FilterSetting,
    type Audio80Instrument,
    type Audio80SoundEffect,
    VOICE_COUNT,
    type Audio80VoiceSetting,
    type Audio80Wave,
} from '../audio80';
import { createRenderedControls, createSilentControls, ignore } from './headless-controls';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio80 with no speaker, and its controls. A game run headless uses
 * one, for example to make thumbnails or run benchmarks. Tests and tools use
 * one too. What it does with each write depends on the options it was made
 * with:
 *
 * - With no options, it does nothing. Writes cost almost nothing. The clock
 *   still runs, so code that stamps writes behaves as usual.
 * - With `record: true`, it logs every write. Its `audio80` then has `log`
 *   and `clear`.
 * - With `render`, it plays every write in memory. The object returned then
 *   has `render` and `sampleRate`, beside `audio80` and `controls`.
 * - With both, it logs every write and plays it.
 *
 * The type includes `log` and `clear` only when `record: true` is given, and
 * `render` and `sampleRate` only when `render` is given. So a test can't read
 * a log that nothing writes to.
 */
export type HeadlessAudio80<O extends HeadlessAudio80Options = HeadlessAudio80Options> =
    & Audio80WithControls<O extends { readonly record: true } ? Audio80 & Audio80Log : Audio80>
    & (O extends { readonly render: true | HeadlessAudio80RenderOptions } ? Audio80Renderer : unknown);

/**
 * The log on a headless chip made with `record: true`. A test advances its
 * clock through the controls made alongside it, as a game loop would.
 */
export interface Audio80Log {
    /** Every write since the last `clear`, oldest first. */
    readonly log: readonly Audio80Write[];
    /** Empties the log. */
    clear: () => void;
}

/**
 * One write, with the stamp it was given and its value as written. An effect
 * is stamped `-Infinity`, because it plays as soon as it arrives. The value
 * is a name for a voice's `'wave'` and a filter's `'mode'`, and a number for
 * every other setting.
 */
export type Audio80Write =
    | { readonly kind: 'play'; readonly effect: Audio80SoundEffect; readonly time: number }
    | { readonly kind: 'note-on'; readonly voice: number; readonly instrument: Audio80Instrument; readonly note: number; readonly volume: number; readonly time: number }
    | { readonly kind: 'note-off'; readonly voice: number; readonly time: number }
    | { readonly kind: 'set-voice'; readonly voice: number; readonly setting: 'wave'; readonly value: Audio80Wave; readonly time: number }
    | { readonly kind: 'set-voice'; readonly voice: number; readonly setting: Exclude<Audio80VoiceSetting, 'wave'>; readonly value: number; readonly time: number }
    | { readonly kind: 'set-filter'; readonly filter: Audio80FilterId; readonly setting: 'mode'; readonly value: Audio80FilterMode; readonly time: number }
    | { readonly kind: 'set-filter'; readonly filter: Audio80FilterId; readonly setting: Exclude<Audio80FilterSetting, 'mode'>; readonly value: number; readonly time: number }
    | { readonly kind: 'set-echo'; readonly setting: Audio80EchoSetting; readonly value: number; readonly time: number }
    | { readonly kind: 'reserve-voices'; readonly count: number; readonly time: number }
    | { readonly kind: 'release-all'; readonly time: number };

/**
 * What a headless chip made with `render` adds. It plays every write exactly
 * at its stamp. Nothing here runs in real time, so unlike the browser's chip,
 * it does not need to play a little behind the game loop. Advance its clock
 * with `AudioControls.update`, then `render` the samples up to it. Its
 * volumes apply to the samples `render` writes. `AudioControls.flush` does
 * nothing, since `render` takes the writes itself.
 */
export interface Audio80Renderer {
    /** The sample rate it renders at, in Hz. */
    readonly sampleRate: number;
    /**
     * Renders the next `output.length` samples into `output`, from where the
     * last render ended, and plays the writes made since. The chip is mono,
     * so there is one sample for each instant. Each is -1 to 1, or beyond for
     * a mix turned up past 1. It allocates nothing, so a caller can render
     * block after block into the same buffer.
     */
    render: (output: Float32Array) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a headless Audio80. With neither option, it plays nothing and logs nothing. */
export interface HeadlessAudio80Options {
    /** Whether to log every write, on the chip's `log`. Defaults to false. */
    readonly record?: boolean;
    /** Whether to render, and how. `true` renders with the default options. Defaults to false, which renders nothing. */
    readonly render?: boolean | HeadlessAudio80RenderOptions;
}

/** How a headless Audio80 renders. */
export interface HeadlessAudio80RenderOptions {
    /** The sample rate to render at, in Hz. Defaults to 48,000. */
    readonly sampleRate?: number;
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a headless Audio80 and its controls, with its clock at 0 and nothing
 * logged or rendered. Only what the options ask for is built. With neither
 * option, writes are empty functions and there is no synthesis.
 */
export function createHeadlessAudio80<const O extends HeadlessAudio80Options = HeadlessAudio80Options>(options?: O): HeadlessAudio80<O> {
    const record = options?.record === true;
    const render = options?.render ?? false;
    let chip: Audio80WithControls;
    if (render !== false) chip = createRenderingChip({ ...(render === true ? {} : render), record });
    else if (record) chip = createRecordingChip();
    else chip = createSilentChip();
    return chip as HeadlessAudio80<O>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_SAMPLE_RATE = 48000;

/** Creates a chip that plays nothing and logs nothing. Every write is an empty function. */
function createSilentChip(): Audio80WithControls {
    // In a typed array, so advancing it boxes no double
    const clock = new Float64Array(1);
    const audio80: Audio80 = {
        get time() {
            return clock[0];
        },
        voiceCount: VOICE_COUNT,
        play: ignore,
        noteOn: ignore,
        noteOff: ignore,
        setVoice: ignore,
        setFilter: ignore,
        setEcho: ignore,
        reserveVoices: ignore,
        releaseAll: ignore,
    };
    const controls = createSilentControls({
        update(deltaMs) {
            clock[0] += deltaMs;
        },
    });
    return { audio80, controls };
}

/** Creates a chip that logs every write and plays nothing. */
function createRecordingChip(): Audio80WithControls<Audio80 & Audio80Log> {
    const clock = { time: 0 };
    const audio80 = createRecorder(clock);
    const controls = createSilentControls({
        update(deltaMs) {
            clock.time += deltaMs;
        },
    });
    return { audio80, controls };
}

/** Creates a chip that plays every write in memory, and also logs it if `record` is true. */
function createRenderingChip(options: HeadlessAudio80RenderOptions & { readonly record: boolean }): Audio80WithControls & Audio80Renderer {
    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const msPerSample = 1000 / sampleRate;
    const synthesiser = createAudio80Synthesiser({ sampleRate, character: options.character });
    const writer = createCommandAudio80({
        onInstrument: (id, data) => synthesiser.defineInstrument(id, data),
        onEffect: (id, data) => synthesiser.defineEffect(id, data),
    });
    let renderedFrames = 0;

    const audio80 = options.record ? createRecordingWriter() : createWriter();
    const controls = createRenderedControls({ writer, synthesiser });

    return {
        audio80,
        controls,
        sampleRate,
        render(output) {
            synthesiser.enqueue(writer.commands, writer.count);
            // Pass the same buffer back, so the writer reuses it rather than making a new one
            writer.clear(writer.commands);
            const frames = output.length;
            synthesiser.render(output, 0, frames, renderedFrames * msPerSample, msPerSample);
            renderedFrames += frames;
            const gain = controls.isMuted ? 0 : controls.volume;
            if (gain !== 1) {
                for (let i = 0; i < frames; i++) output[i] *= gain;
            }
        },
    };

    /**
     * Creates the chip for when only `render` is given. It is the writer with
     * only the Audio80's members, leaving out `commands` and the others that
     * are not the chip's.
     */
    function createWriter(): Audio80 {
        return {
            get time() {
                return writer.time;
            },
            voiceCount: writer.voiceCount,
            play: writer.play,
            noteOn: writer.noteOn,
            noteOff: writer.noteOff,
            setVoice: writer.setVoice,
            setFilter: writer.setFilter,
            setEcho: writer.setEcho,
            reserveVoices: writer.reserveVoices,
            releaseAll: writer.releaseAll,
        };
    }

    /** Creates the chip for when both `record` and `render` are given. Each write is logged, then passed to the writer. */
    function createRecordingWriter(): Audio80 & Audio80Log {
        const recorder = createRecorder(writer);
        return {
            get time() {
                return writer.time;
            },
            voiceCount: writer.voiceCount,
            log: recorder.log,
            clear: recorder.clear,
            play(effect) {
                recorder.play(effect);
                writer.play(effect);
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
            setFilter(filter, setting, value, atMs) {
                recorder.setFilter(filter, setting, value, atMs);
                writer.setFilter(filter, setting, value, atMs);
            },
            setEcho(setting, value, atMs) {
                recorder.setEcho(setting, value, atMs);
                writer.setEcho(setting, value, atMs);
            },
            reserveVoices(count, atMs) {
                recorder.reserveVoices(count, atMs);
                writer.reserveVoices(count, atMs);
            },
            releaseAll() {
                recorder.releaseAll();
                writer.releaseAll();
            },
        };
    }
}

/** Creates an Audio80 that logs every write and plays nothing. A write with no stamp is stamped with `clock`'s time. */
function createRecorder(clock: { readonly time: number }): Audio80 & Audio80Log {
    const log: Audio80Write[] = [];
    return {
        get time() {
            return clock.time;
        },
        voiceCount: VOICE_COUNT,
        log,
        clear() {
            log.length = 0;
        },
        play(effect) {
            log.push({ kind: 'play', effect, time: -Infinity });
        },
        noteOn(voice, instrument, note, volume, atMs) {
            log.push({ kind: 'note-on', voice, instrument, note, volume, time: atMs ?? clock.time });
        },
        noteOff(voice, atMs) {
            log.push({ kind: 'note-off', voice, time: atMs ?? clock.time });
        },
        setVoice(voice, setting, value, atMs) {
            // The signature makes sure the setting and its value agree. TypeScript can't follow that
            // into the union, so the write is cast
            log.push({ kind: 'set-voice', voice, setting, value, time: atMs ?? clock.time } as Audio80Write);
        },
        setFilter(filter, setting, value, atMs) {
            log.push({ kind: 'set-filter', filter, setting, value, time: atMs ?? clock.time } as Audio80Write);
        },
        setEcho(setting, value, atMs) {
            log.push({ kind: 'set-echo', setting, value, time: atMs ?? clock.time });
        },
        reserveVoices(count, atMs) {
            log.push({ kind: 'reserve-voices', count, time: atMs ?? clock.time });
        },
        releaseAll() {
            log.push({ kind: 'release-all', time: clock.time });
        },
    };
}

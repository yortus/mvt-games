import {
    type Audio80,
    type Audio80Character,
    type Audio80PlayOptions,
    type Audio80Song,
    type Audio80Sound,
    type Audio80Writer,
    type CommandAudio80,
    createAudio80Synthesiser,
    createCommandAudio80,
    VOICE_COUNT,
} from '../audio80';
import { joinMembers } from '../shared';
import { createSongPlayer } from '../song-player';
import { createHeadlessChip, type HeadlessChip, ignore } from './headless-chip';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio80 with no speaker. A game run headless plays on one, for example
 * to make thumbnails or run benchmarks. Tests and tools use one too. The
 * code that owns it moves its clock on with `update`. What it does with each
 * write depends on the options it was made with:
 *
 * - With no options, it does nothing. Writes cost almost nothing. The clock
 *   still runs, so code that stamps writes behaves as usual.
 * - With `record: true`, it logs every write, on `log`.
 * - With `render`, it plays every write in memory, and `renderInto` renders
 *   the samples.
 * - With both, it logs every write and plays it.
 */
export interface HeadlessAudio80 extends Audio80, HeadlessChip<Audio80Song, Audio80Sound, Audio80PlayOptions> {
    /** Every write since the last `clear`, oldest first, if the chip records. Otherwise it stays empty. */
    readonly log: readonly Audio80Write[];
    /** Empties the log. */
    clear: () => void;
    /** The sample rate it renders at, in Hz. */
    readonly sampleRate: number;
    /**
     * Renders the next `output.length` samples into `output`, from where the
     * last render ended, and plays the writes made since, each exactly at its
     * stamp. Move the chip's clock on with `update`, then render the samples
     * up to it. The chip is mono, so there is one sample for each instant.
     * Each is -1 to 1, or beyond for a mix turned up past 1. Its volume and
     * mute apply. It allocates nothing, so a caller can render block after
     * block into the same buffer. It throws if the chip was made without
     * `render`.
     */
    renderInto: (output: Float32Array) => void;
}

/**
 * One write, with the time it applies at. A play, and a stop, are stamped
 * `-Infinity`, because they apply as soon as they arrive. A play keeps the
 * options it was given, if any. A stop with no id stops everything. A song's
 * notes are logged as `note-on` and `note-off`, at the chip time each plays
 * at, on the voice of the song's channel. What else a song sets as it plays,
 * such as its filters and slides, is not logged.
 */
export type Audio80Write =
    | { readonly kind: 'play'; readonly sound: Audio80Sound; readonly id: number; readonly options: Audio80PlayOptions | undefined; readonly time: number }
    | { readonly kind: 'stop'; readonly id: number | undefined; readonly time: number }
    | { readonly kind: 'note-on'; readonly voice: number; readonly sound: Audio80Sound; readonly note: number; readonly volume: number; readonly time: number }
    | { readonly kind: 'note-off'; readonly voice: number; readonly time: number };

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
 * Creates a headless Audio80, with its clock at 0 and nothing logged or
 * rendered. Only what the options ask for is built. With neither option,
 * writes are empty functions and there is no synthesis.
 *
 * The chip is also its own writer, which its song writes its notes through,
 * so the code that renders a song can play one on it.
 */
export function createHeadlessAudio80(options: HeadlessAudio80Options = {}): HeadlessAudio80 {
    const renderOptions = options.render === true ? {} : options.render === false ? undefined : options.render;
    const sampleRate = renderOptions?.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const log: Audio80Write[] = [];
    const rendering = renderOptions === undefined ? undefined : createRendering(sampleRate, renderOptions.character);
    const inner = rendering?.writer ?? createSilentWriter();
    const writer = options.record === true ? createLoggingWriter(log, inner) : inner;
    const chip = createHeadlessChip<Audio80Song, Audio80Sound, Audio80PlayOptions>({
        writer,
        player: createSongPlayer({ audio80: writer }),
        cut: rendering?.cut,
        logStop: options.record === true ? (id) => log.push({ kind: 'stop', id, time: -Infinity }) : undefined,
    });

    return joinMembers(chip, {
        // The writer's own members, which the chip's type leaves out, for code that writes a song's notes
        get time() {
            return writer.time;
        },
        voiceCount: VOICE_COUNT,
        setVoice: writer.setVoice,
        setFilter: writer.setFilter,
        setEcho: writer.setEcho,
        noteOn: writer.noteOn,
        noteOff: writer.noteOff,
        releaseAll: writer.releaseAll,
        log,
        clear() {
            log.length = 0;
        },
        sampleRate,
        renderInto(output: Float32Array) {
            if (rendering === undefined) throw new Error('renderInto: this headless Audio80 was made without `render`, so it renders nothing');
            rendering.render(output, chip.isMuted ? 0 : chip.volume);
        },
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_SAMPLE_RATE = 48000;

/** What a headless Audio80 writes through: a writer, and what the chip needs of one to play and stop sounds. */
type Audio80Side = Audio80Writer & Pick<CommandAudio80, 'update' | 'play' | 'stop' | 'takePlayId'>;

/** Creates a writer that plays nothing. Every write is an empty function, and only the clock and the play ids move. */
function createSilentWriter(): Audio80Side {
    // In a typed array, so advancing it boxes no double
    const clock = new Float64Array(1);
    let nextPlayId = 1;
    return {
        get time() {
            return clock[0];
        },
        voiceCount: VOICE_COUNT,
        update(deltaMs) {
            clock[0] += deltaMs;
        },
        play: () => nextPlayId++,
        stop: ignore,
        takePlayId: () => nextPlayId++,
        noteOn: ignore,
        noteOff: ignore,
        setVoice: ignore,
        setFilter: ignore,
        setEcho: ignore,
        releaseAll: ignore,
    };
}

/**
 * Creates a writer that logs each write in `log`, then passes it to `inner`.
 * A write with no stamp is stamped with the time on `inner`'s clock.
 */
function createLoggingWriter(log: Audio80Write[], inner: Audio80Side): Audio80Side {
    return {
        get time() {
            return inner.time;
        },
        voiceCount: VOICE_COUNT,
        update: inner.update,
        play(sound, playOptions) {
            // The inner writer checks the options and numbers the play, so the log takes its id
            const id = inner.play(sound, playOptions);
            log.push({ kind: 'play', sound, id, options: playOptions, time: -Infinity });
            return id;
        },
        // The chip logs its stops itself, since a stop of a song or of everything never reaches the writer
        stop: inner.stop,
        takePlayId: inner.takePlayId,
        noteOn(voice, sound, note, volume, atMs) {
            log.push({ kind: 'note-on', voice, sound, note, volume, time: atMs ?? inner.time });
            inner.noteOn(voice, sound, note, volume, atMs);
        },
        noteOff(voice, atMs) {
            log.push({ kind: 'note-off', voice, time: atMs ?? inner.time });
            inner.noteOff(voice, atMs);
        },
        // A song's settings are not logged
        setVoice: inner.setVoice,
        setFilter: inner.setFilter,
        setEcho: inner.setEcho,
        releaseAll: inner.releaseAll,
    };
}

/** A synthesiser in memory, the writer that feeds it, and how to render and cut it. */
interface Rendering {
    readonly writer: CommandAudio80;
    /** Renders the next `output.length` samples into `output`, scaled by `gain`. */
    readonly render: (output: Float32Array, gain: number) => void;
    /** Cuts every voice at once, and forgets every sound. */
    readonly cut: () => void;
}

/** Creates a synthesiser that renders at `sampleRate`, and the writer that feeds it, with nothing rendered yet. */
function createRendering(sampleRate: number, character: Audio80Character | undefined): Rendering {
    const msPerSample = 1000 / sampleRate;
    const synthesiser = createAudio80Synthesiser({ sampleRate, character });
    const writer = createCommandAudio80({
        onSound: (id, data) => synthesiser.defineSound(id, data),
    });
    let renderedFrames = 0;
    return {
        writer,
        render(output, gain) {
            synthesiser.enqueue(writer.commands, writer.count);
            // Pass the same buffer back, so the writer reuses it rather than making a new one
            writer.clear(writer.commands);
            const frames = output.length;
            synthesiser.render(output, 0, frames, renderedFrames * msPerSample, msPerSample);
            renderedFrames += frames;
            if (gain !== 1) {
                for (let i = 0; i < frames; i++) output[i] *= gain;
            }
        },
        cut() {
            writer.clear(writer.commands);
            writer.forget();
            synthesiser.reset();
        },
    };
}

import {
    type Audio90,
    type Audio90Character,
    type Audio90EffectId,
    type Audio90EffectSetting,
    type Audio90PlayOptions,
    type Audio90Song,
    type Audio90Sound,
    AUDIO90_SCOPE_LENGTH,
    AUDIO90_VOICE_COUNT,
    type Audio90VoiceSetting,
    type Audio90Writer,
    type CommandAudio90,
    createAudio90Synthesiser,
    createCommandAudio90,
} from '../audio90';
import { joinMembers, MIX_BUS_INDEX } from '../shared';
import { createSongPlayer } from '../song-player';
import { createHeadlessChip, type HeadlessChip, ignore } from './headless-chip';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio90 with no speaker. A game run headless plays on one, for example
 * to make thumbnails or run benchmarks. Tests and tools use one too. The
 * code that owns it moves its clock on with `update`. What it does with each
 * write depends on the options it was made with, as for the headless
 * Audio80:
 *
 * - With no options, it does nothing. Writes cost almost nothing. The clock
 *   still runs, so code that stamps writes behaves as usual.
 * - With `record: true`, it logs every write, on `log`.
 * - With `render`, it plays every write in memory, in stereo, and
 *   `renderInto` renders the samples.
 * - With both, it logs every write and plays it.
 */
export interface HeadlessAudio90 extends Audio90, HeadlessChip<Audio90Song, Audio90Sound, Audio90PlayOptions> {
    /** Every write since the last `clear`, oldest first, if the chip records. Otherwise it stays empty. */
    readonly log: readonly Audio90Write[];
    /** Empties the log. */
    clear: () => void;
    /** The sample rate it renders at, in Hz. */
    readonly sampleRate: number;
    /**
     * Renders the next `left.length` samples into `left` and `right`, the two
     * channels, from where the last render ended, and plays the writes made
     * since, each exactly at its stamp. Move the chip's clock on with
     * `update`, then render the samples up to it. `right` must be at least as
     * long as `left`. Each sample is -1 to 1, or beyond for a mix turned up
     * past 1. Its volume and mute apply. It allocates nothing, so a caller can
     * render block after block into the same buffers. It throws if the chip
     * was made without `render`.
     */
    renderInto: (left: Float32Array, right: Float32Array) => void;
}

/**
 * One write to an Audio90, with the stamp it was given and its value as
 * written. A play, and a stop, are stamped `-Infinity`, because they apply
 * as soon as they arrive. A play keeps the options it was given, if any. A
 * stop with no id stops everything. A song's notes are logged as `note-on`
 * and `note-off`.
 */
export type Audio90Write =
    | { readonly kind: 'play'; readonly sound: Audio90Sound; readonly id: number; readonly options: Audio90PlayOptions | undefined; readonly time: number }
    | { readonly kind: 'stop'; readonly id: number | undefined; readonly time: number }
    | { readonly kind: 'note-on'; readonly voice: number; readonly sound: Audio90Sound; readonly note: number; readonly volume: number; readonly time: number }
    | { readonly kind: 'note-off'; readonly voice: number; readonly time: number }
    | { readonly kind: 'set-voice'; readonly voice: number; readonly setting: Audio90VoiceSetting; readonly value: number; readonly time: number }
    | Audio90EffectWrite
    | { readonly kind: 'set-character'; readonly character: Audio90Character; readonly time: number }
    | { readonly kind: 'set-tempo'; readonly bpm: number; readonly time: number }
    | { readonly kind: 'reserve-voices'; readonly count: number; readonly time: number };

/** A write to one of an effect's settings, whose setting is one of that effect's. */
export type Audio90EffectWrite = {
    readonly [E in Audio90EffectId]: { readonly kind: 'set-effect'; readonly effect: E; readonly setting: Audio90EffectSetting<E>; readonly value: number; readonly time: number };
}[Audio90EffectId];

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
 * Creates a headless Audio90, with its clock at 0 and nothing logged or
 * rendered. Only what the options ask for is built. With neither option,
 * writes are empty functions and there is no synthesis.
 *
 * The chip is also its own writer, which its song writes its notes through,
 * so the code that renders a song can play one on it.
 */
export function createHeadlessAudio90(options: HeadlessAudio90Options = {}): HeadlessAudio90 {
    const renderOptions = options.render === true ? {} : options.render === false ? undefined : options.render;
    const sampleRate = renderOptions?.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const log: Audio90Write[] = [];
    // The synthesiser writes the scope as it renders, while scopes are on. A chip that doesn't render leaves it silent
    const scope = new Float32Array(AUDIO90_SCOPE_LENGTH);
    const rendering = renderOptions === undefined ? undefined : createRendering(sampleRate, renderOptions.character, scope);
    const inner = rendering?.writer ?? createSilentWriter();
    const writer = options.record === true ? createLoggingWriter(log, inner) : inner;
    const chip = createHeadlessChip<Audio90Song, Audio90Sound, Audio90PlayOptions>({
        writer,
        player: createSongPlayer({ audio90: writer }),
        cut: rendering?.cut,
        logStop: options.record === true ? (id) => log.push({ kind: 'stop', id, time: -Infinity }) : undefined,
    });

    return joinMembers(chip, {
        get time() {
            return writer.time;
        },
        // A chip with no speaker hears each write as it is made
        get heardTime() {
            return writer.time;
        },
        voiceCount: AUDIO90_VOICE_COUNT,
        setVoice: writer.setVoice,
        setEffect: writer.setEffect,
        setCharacter: writer.setCharacter,
        setTempo: writer.setTempo,
        reserveVoices: writer.reserveVoices,
        // The writer's own members, which the chip's type leaves out, for code that writes a song's notes
        noteOn: writer.noteOn,
        noteOff: writer.noteOff,
        releaseAll: writer.releaseAll,
        scope,
        setScopes: rendering?.setScopes ?? ignore,
        log,
        clear() {
            log.length = 0;
        },
        sampleRate,
        renderInto(left: Float32Array, right: Float32Array) {
            if (rendering === undefined) throw new Error('renderInto: this headless Audio90 was made without `render`, so it renders nothing');
            rendering.render(left, right, chip.isMuted ? 0 : chip.volume);
        },
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_SAMPLE_RATE = 48000;

/** What a headless Audio90 writes through: a writer, and what the chip needs of one to play and stop sounds. */
type Audio90Side = Audio90Writer & Pick<CommandAudio90, 'update' | 'play' | 'stop' | 'takePlayId' | 'setMix'>;

/** Creates a writer that plays nothing. Every write is an empty function, and only the clock and the play ids move. */
function createSilentWriter(): Audio90Side {
    // In a typed array, so advancing it boxes no double
    const clock = new Float64Array(1);
    let nextPlayId = 1;
    return {
        get time() {
            return clock[0];
        },
        voiceCount: AUDIO90_VOICE_COUNT,
        update(deltaMs) {
            clock[0] += deltaMs;
        },
        play: () => nextPlayId++,
        stop: ignore,
        takePlayId: () => nextPlayId++,
        setMix: ignore,
        noteOn: ignore,
        noteOff: ignore,
        setVoice: ignore,
        setEffect: ignore,
        setCharacter: ignore,
        setTempo: ignore,
        reserveVoices: ignore,
        releaseAll: ignore,
    };
}

/**
 * Creates a writer that logs each write in `log`, then passes it to `inner`.
 * A write with no stamp is stamped with the time on `inner`'s clock.
 */
function createLoggingWriter(log: Audio90Write[], inner: Audio90Side): Audio90Side {
    return {
        get time() {
            return inner.time;
        },
        voiceCount: AUDIO90_VOICE_COUNT,
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
        setMix: inner.setMix,
        noteOn(voice, sound, note, volume, atMs) {
            log.push({ kind: 'note-on', voice, sound, note, volume, time: atMs ?? inner.time });
            inner.noteOn(voice, sound, note, volume, atMs);
        },
        noteOff(voice, atMs) {
            log.push({ kind: 'note-off', voice, time: atMs ?? inner.time });
            inner.noteOff(voice, atMs);
        },
        setVoice(voice, setting, value, atMs) {
            log.push({ kind: 'set-voice', voice, setting, value, time: atMs ?? inner.time });
            inner.setVoice(voice, setting, value, atMs);
        },
        setEffect(effect, setting, value, atMs) {
            // The signature makes sure the effect and its setting agree. TypeScript can't follow that
            // into the union, so the write is cast
            log.push({ kind: 'set-effect', effect, setting, value, time: atMs ?? inner.time } as Audio90EffectWrite);
            inner.setEffect(effect, setting, value, atMs);
        },
        setCharacter(character, atMs) {
            log.push({ kind: 'set-character', character, time: atMs ?? inner.time });
            inner.setCharacter(character, atMs);
        },
        setTempo(bpm, atMs) {
            log.push({ kind: 'set-tempo', bpm, time: atMs ?? inner.time });
            inner.setTempo(bpm, atMs);
        },
        reserveVoices(count, atMs) {
            log.push({ kind: 'reserve-voices', count, time: atMs ?? inner.time });
            inner.reserveVoices(count, atMs);
        },
        releaseAll: inner.releaseAll,
    };
}

/** A synthesiser in memory, the writer that feeds it, and how to render it, cut it and turn its scopes on. */
interface Rendering {
    readonly writer: CommandAudio90;
    /** Renders the next `left.length` samples into `left` and `right`, scaled by `gain`. */
    readonly render: (left: Float32Array, right: Float32Array, gain: number) => void;
    /** Cuts every voice at once, forgets every sound, and sets the mix to these volumes at once. */
    readonly cut: (musicVolume: number, effectsVolume: number) => void;
    /** Turns the scopes on or off. */
    readonly setScopes: (isOn: boolean) => void;
}

/**
 * Creates a synthesiser that renders at `sampleRate`, and the writer that
 * feeds it, with nothing rendered yet. While scopes are on, the synthesiser
 * writes them into `scope`.
 */
function createRendering(sampleRate: number, character: Audio90Character | undefined, scope: Float32Array): Rendering {
    const msPerSample = 1000 / sampleRate;
    const synthesiser = createAudio90Synthesiser({ sampleRate, character });
    const writer = createCommandAudio90({
        onSound: (id, data) => synthesiser.defineSound(id, data),
        // A sample too big for what is left of sample memory is dropped, as the worklet drops it
        onSample: (id, data) => synthesiser.defineSample(id, data),
    });
    let renderedFrames = 0;
    return {
        writer,
        render(left, right, gain) {
            synthesiser.enqueue(writer.commands, writer.count);
            // Pass the same buffer back, so the writer reuses it rather than making a new one
            writer.clear(writer.commands);
            const frames = left.length;
            synthesiser.render(left, right, 0, frames, renderedFrames * msPerSample, msPerSample);
            renderedFrames += frames;
            if (gain !== 1) {
                for (let i = 0; i < frames; i++) {
                    left[i] *= gain;
                    right[i] *= gain;
                }
            }
        },
        cut(musicVolume, effectsVolume) {
            writer.clear(writer.commands);
            writer.forget();
            synthesiser.reset();
            synthesiser.setMix(MIX_BUS_INDEX.music, musicVolume);
            synthesiser.setMix(MIX_BUS_INDEX.effects, effectsVolume);
        },
        setScopes(isOn) {
            synthesiser.scope = isOn ? scope : undefined;
            if (!isOn) scope.fill(0);
        },
    };
}

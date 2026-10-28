import { type Audio80Character, isAudio80Song, isAudio80Sound, type Audio80Song, type Audio80Sound, type Audio80Writer } from '../audio80';
import { type Audio90Character, type Audio90Song, type Audio90Sound, type Audio90Writer, isAudio90Song, isAudio90Sound } from '../audio90';
import { createSongPlayer } from '../song-player';
import { createHeadlessAudio80, type HeadlessAudio80 } from './headless-audio80';
import { createHeadlessAudio90, type HeadlessAudio90 } from './headless-audio90';
import { toInt16 } from './encode-wav';
import { listChannels, type RenderedSamples, type StereoSamples } from './stereo-samples';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A module's songs and sounds, for either chip, each with the name the module exports it under. */
export interface ModuleSounds {
    readonly songs: readonly (readonly [string, Audio80Song | Audio90Song])[];
    readonly sounds: readonly (readonly [string, Audio80Sound | Audio90Sound])[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to render a song or a sound, on either chip. */
export interface RenderOptions {
    /** The sample rate to render at, in Hz. Defaults to 48,000. */
    readonly sampleRate?: number;
    /** How long each tick is, in ms, as a game loop would advance the chip. Defaults to 1000 / 60. */
    readonly tickMs?: number;
    /** How long to render, in ms. Defaults to the sound's length plus a tail for its release and echo. */
    readonly durationMs?: number;
}

/** How to render an Audio80's song or sound. */
export interface Audio80RenderOptions extends RenderOptions {
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
}

/** How to render an Audio90's song or sound. */
export interface Audio90RenderOptions extends RenderOptions {
    /** How the chip sounds. Defaults to `'studio'`. */
    readonly character?: Audio90Character;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Renders an Audio80's `song` or `sound`, and returns the chip's one channel
 * of samples. A song plays one pass through its order, as a game loop would
 * tick the chip. A sound plays once, as the sound says.
 */
export function render(songOrSound: Audio80Song | Audio80Sound, options?: Audio80RenderOptions): Float32Array;
/** Renders an Audio90's `song` or `sound`, as for the Audio80, and returns the chip's two channels of samples. */
export function render(songOrSound: Audio90Song | Audio90Sound, options?: Audio90RenderOptions): StereoSamples;
/** Renders either chip's song or sound, as a test that goes through a module's songs and sounds does. */
export function render(songOrSound: Audio80Song | Audio80Sound | Audio90Song | Audio90Sound, options?: RenderOptions): RenderedSamples;
export function render(songOrSound: Audio80Song | Audio80Sound | Audio90Song | Audio90Sound, options: Audio80RenderOptions | Audio90RenderOptions = {}): RenderedSamples {
    const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    if (isAudio80Sound(songOrSound) || isAudio90Sound(songOrSound)) {
        if (songOrSound.chip === 'audio90') {
            const chip = createRenderingAudio90(options as Audio90RenderOptions);
            chip.play(songOrSound);
            const durationMs = options.durationMs ?? songOrSound.data.lengthMs + songOrSound.data.envelope.releaseMs + TAIL_MS;
            return renderStereoTicks(chip, durationMs, tickMs, ignore);
        }
        const chip = createRenderingAudio80(options as Audio80RenderOptions);
        chip.play(songOrSound);
        const durationMs = options.durationMs ?? songOrSound.data.lengthMs + songOrSound.data.releaseMs + TAIL_MS;
        return renderTicks(chip, durationMs, tickMs, ignore);
    }
    const song = songOrSound;
    const passMs = song.durationMs;
    const durationMs = options.durationMs ?? passMs + TAIL_MS;
    if (song.chip === 'audio90') {
        const chip = createRenderingAudio90(options as Audio90RenderOptions);
        // A song player of its own, rather than the chip's, so the song stops in a tick before that tick's notes are
        // written
        const player = createSongPlayer({ audio90: chip });
        player.play(song);
        return renderStereoTicks(chip, durationMs, tickMs, (deltaMs) => {
            // Render one pass. A looping song is stopped where it would start again
            if (song.loop >= 0 && chip.time >= passMs) player.stop();
            player.update(deltaMs);
            player.refresh();
        });
    }
    const chip = createRenderingAudio80(options as Audio80RenderOptions);
    const player = createSongPlayer({ audio80: chip });
    player.play(song);
    return renderTicks(chip, durationMs, tickMs, (deltaMs) => {
        if (song.loop >= 0 && chip.time >= passMs) player.stop();
        player.update(deltaMs);
        player.refresh();
    });
}

/**
 * Ticks `chip` every `tickMs` for `durationMs`, and renders as it goes.
 * `tickMs` is in ms and must be more than 0. `onTick` is called after each
 * tick. Returns the samples.
 */
export function renderTicks(chip: HeadlessAudio80 & Audio80Writer, durationMs: number, tickMs: number, onTick: (deltaMs: number) => void): Float32Array {
    const samples = new Float32Array(Math.round(durationMs * chip.sampleRate / 1000));
    runTicks({
        chip,
        sampleRate: chip.sampleRate,
        total: samples.length,
        tickMs,
        onTick,
        render: (from, to) => chip.renderInto(samples.subarray(from, to)),
    });
    return samples;
}

/** Ticks a headless Audio90 every `tickMs` for `durationMs`, as `renderTicks` ticks an Audio80, and renders both channels as it goes. */
export function renderStereoTicks(chip: HeadlessAudio90 & Audio90Writer, durationMs: number, tickMs: number, onTick: (deltaMs: number) => void): StereoSamples {
    const total = Math.round(durationMs * chip.sampleRate / 1000);
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    runTicks({
        chip,
        sampleRate: chip.sampleRate,
        total,
        tickMs,
        onTick,
        render: (from, to) => chip.renderInto(left.subarray(from, to), right.subarray(from, to)),
    });
    return { left, right };
}

/**
 * A short hash of rendered sound, to compare with one recorded earlier. It
 * hashes the samples rounded to 16 bits, as a WAV file holds them. So a
 * difference too small to survive in a WAV file does not count. Stereo sound
 * is hashed a frame at a time, the left sample then the right, as a WAV file
 * holds it.
 */
export function hashSamples(samples: RenderedSamples): string {
    let hash = FNV_OFFSET;
    if (samples instanceof Float32Array) {
        for (let i = 0; i < samples.length; i++) hash = mix(hash, toInt16(samples[i]));
    }
    else {
        const { left, right } = samples;
        for (let i = 0; i < left.length; i++) hash = mix(mix(hash, toInt16(left[i])), toInt16(right[i]));
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Finds a module's songs and sounds, for either chip, with the names it
 * exports them under. Tests and scripts use it to go through every sound. A
 * song's instruments are sounds too, so they are found if they are exported.
 *
 * It looks inside exported arrays too, so a set of sounds made in a loop is
 * found. Each sound in an array is named for its place, such as
 * `'FANFARES[2]'`. Entries that aren't sounds, such as `undefined` for a
 * place with no sound, are skipped.
 */
export function findSounds(exports: Readonly<Record<string, unknown>>): ModuleSounds {
    const songs: [string, Audio80Song | Audio90Song][] = [];
    const sounds: [string, Audio80Sound | Audio90Sound][] = [];
    for (const name of Object.keys(exports)) {
        const value = exports[name];
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) addSound(`${name}[${i}]`, value[i]);
        }
        else {
            addSound(name, value);
        }
    }
    return { songs, sounds };

    function addSound(name: string, value: unknown): void {
        if (isAudio80Song(value) || isAudio90Song(value)) songs.push([name, value]);
        else if (isAudio80Sound(value) || isAudio90Sound(value)) sounds.push([name, value]);
    }
}

/** The peak level of rendered sound, from 0 to 1, or more if it clips. For stereo sound, it is the louder channel's. */
export function measurePeak(samples: RenderedSamples): number {
    let peak = 0;
    for (const channel of listChannels(samples)) {
        for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]));
    }
    return peak;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_TICK_MS = 1000 / 60;

/** Creates an Audio80 that renders, as its own writer, with the clock its type leaves out. A song's notes are written through it. */
function createRenderingAudio80(options: Audio80RenderOptions): HeadlessAudio80 & Audio80Writer {
    return createHeadlessAudio80({ render: { sampleRate: options.sampleRate, character: options.character } }) as HeadlessAudio80 & Audio80Writer;
}

/** Creates an Audio90 that renders, as its own writer, as `createRenderingAudio80` does an Audio80. */
function createRenderingAudio90(options: Audio90RenderOptions): HeadlessAudio90 & Audio90Writer {
    return createHeadlessAudio90({ render: { sampleRate: options.sampleRate, character: options.character } }) as HeadlessAudio90 & Audio90Writer;
}
/** How long to render after a sound ends, so its release and echo can die away. */
const TAIL_MS = 600;
// The 32-bit FNV-1a hash's constants
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** What `runTicks` drives: a headless chip that renders, apart from which chip it is. */
interface TickedRender {
    /** The chip, which moves its clock on as it ticks. */
    readonly chip: { readonly time: number; readonly update: (deltaMs: number) => void };
    readonly sampleRate: number;
    /** How many frames to render in all. */
    readonly total: number;
    readonly tickMs: number;
    readonly onTick: (deltaMs: number) => void;
    /** Renders frames `from` to `to` - 1. */
    readonly render: (from: number, to: number) => void;
}

/**
 * Ticks a chip every `tickMs`, calling `onTick` after each tick, and renders
 * the frames up to its clock as it goes, until `total` frames are rendered.
 */
function runTicks(options: TickedRender): void {
    const { chip, sampleRate, total, tickMs, onTick, render } = options;
    // Written so that NaN fails too. With no time passing, the loop below would never end
    if (!(tickMs > 0)) throw new Error('renderTicks: tickMs must be positive');
    let frames = 0;
    while (frames < total) {
        chip.update(tickMs);
        onTick(tickMs);
        const target = Math.min(total, Math.round(chip.time * sampleRate / 1000));
        if (target <= frames) continue;
        render(frames, target);
        frames = target;
    }
}

/** Adds a 16-bit value's two bytes to the hash, low byte first. */
function mix(hash: number, value: number): number {
    let h = hash;
    h = Math.imul(h ^ (value & 0xff), FNV_PRIME);
    h = Math.imul(h ^ ((value >> 8) & 0xff), FNV_PRIME);
    return h;
}

function ignore(): void {
    // Nothing to do each tick
}

import { type Audio80Character, createAudio80SongDriver, isAudio80Song, isAudio80Sound, type Audio80Song, type Audio80Sound } from '../audio80';
import { type Audio90Character, type Audio90Song, type Audio90Sound, createAudio90SongDriver, isAudio90Song, isAudio90Sound } from '../audio90';
import { createSongPlayer } from '../shared';
import { type Audio80Rendering, createAudio80Rendering } from './rendering-audio80';
import { type Audio90Rendering, createAudio90Rendering } from './rendering-audio90';
import { DEFAULT_SAMPLE_RATE } from './headless-chip';
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
    // Written so that NaN fails too. With no time passing, the render would never end
    if (!(tickMs > 0)) throw new Error(`render: tickMs must be above 0; got ${tickMs}`);
    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    if (isAudio80Sound(songOrSound) || isAudio90Sound(songOrSound)) {
        if (songOrSound.chip === 'audio90') {
            const rendering = createAudio90Rendering({ sampleRate, character: (options as Audio90RenderOptions).character });
            rendering.writer.play(songOrSound);
            const durationMs = options.durationMs ?? songOrSound.data.lengthMs + songOrSound.data.envelope.releaseMs + TAIL_MS;
            return renderStereo(rendering, { sampleRate, durationMs, tickMs, onTick: ignore });
        }
        const rendering = createAudio80Rendering({ sampleRate, character: (options as Audio80RenderOptions).character });
        rendering.writer.play(songOrSound);
        const durationMs = options.durationMs ?? songOrSound.data.lengthMs + songOrSound.data.releaseMs + TAIL_MS;
        return renderMono(rendering, { sampleRate, durationMs, tickMs, onTick: ignore });
    }
    const song = songOrSound;
    const passMs = song.durationMs;
    const durationMs = options.durationMs ?? passMs + TAIL_MS;
    if (song.chip === 'audio90') {
        const rendering = createAudio90Rendering({ sampleRate, character: (options as Audio90RenderOptions).character });
        const player = createSongPlayer(createAudio90SongDriver(rendering.writer));
        player.play(song);
        return renderStereo(rendering, {
            sampleRate,
            durationMs,
            tickMs,
            onTick(deltaMs) {
                // Render one pass. A looping song is stopped where it would start again, before that tick's notes are written
                if (song.loop >= 0 && rendering.writer.time >= passMs) player.stop();
                player.update(deltaMs);
            },
        });
    }
    const rendering = createAudio80Rendering({ sampleRate, character: (options as Audio80RenderOptions).character });
    const player = createSongPlayer(createAudio80SongDriver(rendering.writer));
    player.play(song);
    return renderMono(rendering, {
        sampleRate,
        durationMs,
        tickMs,
        onTick(deltaMs) {
            if (song.loop >= 0 && rendering.writer.time >= passMs) player.stop();
            player.update(deltaMs);
        },
    });
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

/** How long to render after a sound ends, so its release and echo can die away. */
const TAIL_MS = 600;
// The 32-bit FNV-1a hash's constants
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** How long to render, and how: the ticks it moves on by, and what each tick plays. */
interface TickedRender {
    readonly sampleRate: number;
    readonly durationMs: number;
    readonly tickMs: number;
    /** Called after the clock moves on by each tick, as a song player is. */
    readonly onTick: (deltaMs: number) => void;
}

/** Renders an Audio80's one channel for as long as `ticked` says, a tick at a time. */
function renderMono(rendering: Audio80Rendering, ticked: TickedRender): Float32Array {
    const samples = new Float32Array(Math.round(ticked.durationMs * ticked.sampleRate / 1000));
    runTicks(rendering.writer, ticked, samples.length, (from, to) => rendering.render(samples.subarray(from, to), 1));
    return samples;
}

/** Renders an Audio90's two channels for as long as `ticked` says, a tick at a time. */
function renderStereo(rendering: Audio90Rendering, ticked: TickedRender): StereoSamples {
    const total = Math.round(ticked.durationMs * ticked.sampleRate / 1000);
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    runTicks(rendering.writer, ticked, total, (from, to) => rendering.render(left.subarray(from, to), right.subarray(from, to), 1));
    return { left, right };
}

/**
 * Moves `clock` on every `tickMs`, calling `onTick` after each tick, and
 * renders frames up to its time as it goes, until `total` frames are
 * rendered.
 */
function runTicks(clock: { readonly time: number; readonly update: (deltaMs: number) => void }, ticked: TickedRender, total: number, render: (from: number, to: number) => void): void {
    const { sampleRate, tickMs, onTick } = ticked;
    let frames = 0;
    while (frames < total) {
        clock.update(tickMs);
        onTick(tickMs);
        const target = Math.min(total, Math.round(clock.time * sampleRate / 1000));
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

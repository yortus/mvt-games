import { type Audio80Character, isAudio80Song, isAudio80SoundEffect, type Audio80Song, type Audio80SoundEffect } from '../audio80';
import { createMusicPlayer } from '../music-player';
import { type Audio90Character, type Audio90Song, type Audio90SoundEffect, isAudio90Song, isAudio90SoundEffect } from '../audio90';
import { type AudioControls, computeSongDurationMs } from '../shared';
import { createHeadlessAudio80, type HeadlessAudio80 } from './headless-audio80';
import { createHeadlessAudio90, type HeadlessAudio90 } from './headless-audio90';
import { toInt16 } from './encode-wav';
import { listChannels, type RenderedSamples, type StereoSamples } from './stereo-samples';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A module's songs and sound effects, for either chip, each with the name the module exports it under. */
export interface ModuleSounds {
    readonly songs: readonly (readonly [string, Audio80Song | Audio90Song])[];
    readonly effects: readonly (readonly [string, Audio80SoundEffect | Audio90SoundEffect])[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to render a song or an effect, on either chip. */
export interface RenderOptions {
    /** The sample rate to render at, in Hz. Defaults to 48,000. */
    readonly sampleRate?: number;
    /** How long each tick is, in ms, as a game loop would advance the chip. Defaults to 1000 / 60. */
    readonly tickMs?: number;
    /** How long to render, in ms. Defaults to the sound's length plus a tail for its release and echo. */
    readonly durationMs?: number;
}

/** How to render an Audio80's song or effect. */
export interface Audio80RenderOptions extends RenderOptions {
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
}

/** How to render an Audio90's song or effect. */
export interface Audio90RenderOptions extends RenderOptions {
    /** How the chip sounds. Defaults to `'studio'`. */
    readonly character?: Audio90Character;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Renders one pass through an Audio80 `song`, ticking the chip as a game loop would. Returns the chip's one channel of samples. */
export function renderSong(song: Audio80Song, options?: Audio80RenderOptions): Float32Array;
/** Renders one pass through an Audio90 `song`, ticking the chip as a game loop would. Returns the chip's two channels of samples. */
export function renderSong(song: Audio90Song, options?: Audio90RenderOptions): StereoSamples;
/** Renders one pass through either chip's `song`, as a test that goes through a module's songs does. */
export function renderSong(song: Audio80Song | Audio90Song, options?: RenderOptions): RenderedSamples;
export function renderSong(song: Audio80Song | Audio90Song, options: Audio80RenderOptions | Audio90RenderOptions = {}): RenderedSamples {
    const passMs = computeSongDurationMs(song);
    const durationMs = options.durationMs ?? passMs + TAIL_MS;
    const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    if (song.chip === 'audio90') {
        const chip = createHeadlessAudio90({ render: options as Audio90RenderOptions });
        const player = createMusicPlayer({ audio90: chip.audio90 });
        player.play(song);
        return renderStereoTicks(chip, durationMs, tickMs, (deltaMs) => {
            // Render one pass. A looping song is stopped where it would start again
            if (song.loop >= 0 && chip.audio90.time >= passMs) player.stop();
            player.update(deltaMs);
            player.refresh();
        });
    }
    const chip = createHeadlessAudio80({ render: options as Audio80RenderOptions });
    const player = createMusicPlayer({ audio80: chip.audio80 });
    player.play(song);
    return renderTicks(chip, durationMs, tickMs, (deltaMs) => {
        if (song.loop >= 0 && chip.audio80.time >= passMs) player.stop();
        player.update(deltaMs);
        player.refresh();
    });
}

/** Renders an Audio80's `effect`, played once. Returns the chip's one channel of samples. */
export function renderSoundEffect(effect: Audio80SoundEffect, options?: Audio80RenderOptions): Float32Array;
/** Renders an Audio90's `effect`, played once at its own pan. Returns the chip's two channels of samples. */
export function renderSoundEffect(effect: Audio90SoundEffect, options?: Audio90RenderOptions): StereoSamples;
/** Renders either chip's `effect`, as a test that goes through a module's effects does. */
export function renderSoundEffect(effect: Audio80SoundEffect | Audio90SoundEffect, options?: RenderOptions): RenderedSamples;
export function renderSoundEffect(effect: Audio80SoundEffect | Audio90SoundEffect, options: Audio80RenderOptions | Audio90RenderOptions = {}): RenderedSamples {
    const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    if (effect.chip === 'audio90') {
        const chip = createHeadlessAudio90({ render: options as Audio90RenderOptions });
        chip.audio90.play(effect);
        const durationMs = options.durationMs ?? effect.data.lengthMs + effect.data.instrument.envelope.releaseMs + TAIL_MS;
        return renderStereoTicks(chip, durationMs, tickMs, ignore);
    }
    const chip = createHeadlessAudio80({ render: options as Audio80RenderOptions });
    chip.audio80.play(effect);
    const durationMs = options.durationMs ?? effect.data.lengthMs + effect.data.instrument.releaseMs + TAIL_MS;
    return renderTicks(chip, durationMs, tickMs, ignore);
}

/**
 * Ticks `chip` every `tickMs` for `durationMs`, and renders as it goes.
 * `tickMs` is in ms and must be more than 0. `onTick` is called after each
 * tick. Returns the samples.
 */
export function renderTicks(chip: HeadlessAudio80<{ render: true }>, durationMs: number, tickMs: number, onTick: (deltaMs: number) => void): Float32Array {
    const samples = new Float32Array(Math.round(durationMs * chip.sampleRate / 1000));
    runTicks({
        controls: chip.controls,
        sampleRate: chip.sampleRate,
        total: samples.length,
        tickMs,
        onTick,
        readTime: () => chip.audio80.time,
        render: (from, to) => chip.render(samples.subarray(from, to)),
    });
    return samples;
}

/** Ticks a headless Audio90 every `tickMs` for `durationMs`, as `renderTicks` ticks an Audio80, and renders both channels as it goes. */
export function renderStereoTicks(chip: HeadlessAudio90<{ render: true }>, durationMs: number, tickMs: number, onTick: (deltaMs: number) => void): StereoSamples {
    const total = Math.round(durationMs * chip.sampleRate / 1000);
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    runTicks({
        controls: chip.controls,
        sampleRate: chip.sampleRate,
        total,
        tickMs,
        onTick,
        readTime: () => chip.audio90.time,
        render: (from, to) => chip.render(left.subarray(from, to), right.subarray(from, to)),
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

/** Finds a module's songs and sound effects, for either chip, with the names it exports them under. Tests and scripts use it to go through every sound. */
export function findSounds(exports: Readonly<Record<string, unknown>>): ModuleSounds {
    const songs: [string, Audio80Song | Audio90Song][] = [];
    const effects: [string, Audio80SoundEffect | Audio90SoundEffect][] = [];
    for (const name of Object.keys(exports)) {
        const value = exports[name];
        if (isAudio80Song(value) || isAudio90Song(value)) songs.push([name, value]);
        else if (isAudio80SoundEffect(value) || isAudio90SoundEffect(value)) effects.push([name, value]);
    }
    return { songs, effects };
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

/** What `runTicks` drives: a headless chip that renders, apart from which chip it is. */
interface TickedRender {
    readonly controls: AudioControls;
    readonly sampleRate: number;
    /** How many frames to render in all. */
    readonly total: number;
    readonly tickMs: number;
    readonly onTick: (deltaMs: number) => void;
    /** Reads the chip's clock, in ms. */
    readonly readTime: () => number;
    /** Renders frames `from` to `to` - 1. */
    readonly render: (from: number, to: number) => void;
}

/**
 * Ticks a chip every `tickMs`, calling `onTick` after each tick, and renders
 * the frames up to its clock as it goes, until `total` frames are rendered.
 */
function runTicks(options: TickedRender): void {
    const { controls, sampleRate, total, tickMs, onTick, readTime, render } = options;
    // Written so that NaN fails too. With no time passing, the loop below would never end
    if (!(tickMs > 0)) throw new Error('renderTicks: tickMs must be positive');
    let frames = 0;
    while (frames < total) {
        controls.update(tickMs);
        onTick(tickMs);
        const target = Math.min(total, Math.round(readTime() * sampleRate / 1000));
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

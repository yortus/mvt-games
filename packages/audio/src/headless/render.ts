import type { Character } from '../core';
import { isSong, isSoundEffect, type SoundEffect, type Song, computeSongDurationMs } from '../notation';
import { createMusicPlayer } from '../music-player';
import { createHeadlessAudio80, type HeadlessAudio80 } from './headless-audio80';
import { toInt16 } from './encode-wav';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A module's songs and sound effects, each with the name the module exports it under. */
export interface ModuleSounds {
    readonly songs: readonly (readonly [string, Song])[];
    readonly effects: readonly (readonly [string, SoundEffect])[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to render a song or an effect. */
export interface RenderOptions {
    /** The sample rate to render at, in Hz. Defaults to 48,000. */
    readonly sampleRate?: number;
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Character;
    /** How long each tick is, in ms, as a game loop would advance the chip. Defaults to 1000 / 60. */
    readonly tickMs?: number;
    /** How long to render, in ms. Defaults to the sound's length plus a tail for its release and echo. */
    readonly durationMs?: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Renders one pass through `song`, ticking the chip as a game loop would. Returns the chip's one channel of samples. */
export function renderSong(song: Song, options: RenderOptions = {}): Float32Array {
    const chip = createHeadlessAudio80({ render: options });
    const player = createMusicPlayer({ audio80: chip.audio80 });
    player.play(song);
    const durationMs = options.durationMs ?? computeSongDurationMs(song) + TAIL_MS;
    const passMs = computeSongDurationMs(song);
    return renderTicks(chip, durationMs, options.tickMs ?? DEFAULT_TICK_MS, (deltaMs) => {
        // Render one pass. A looping song is stopped where it would start again
        if (song.loop >= 0 && chip.audio80.time >= passMs) player.stop();
        player.update(deltaMs);
        player.refresh();
    });
}

/** Renders `effect`, played once. Returns the chip's one channel of samples. */
export function renderSoundEffect(effect: SoundEffect, options: RenderOptions = {}): Float32Array {
    const chip = createHeadlessAudio80({ render: options });
    chip.audio80.play(effect);
    const durationMs = options.durationMs ?? effect.data.lengthMs + effect.data.instrument.releaseMs + TAIL_MS;
    return renderTicks(chip, durationMs, options.tickMs ?? DEFAULT_TICK_MS, ignore);
}

/**
 * Ticks `chip` every `tickMs` for `durationMs`, and renders as it goes.
 * `tickMs` is in ms and must be more than 0. `onTick` is called after each
 * tick. Returns the samples.
 */
export function renderTicks(chip: HeadlessAudio80<{ render: true }>, durationMs: number, tickMs: number, onTick: (deltaMs: number) => void): Float32Array {
    // Written so that NaN fails too. With no time passing, the loop below would never end
    if (!(tickMs > 0)) throw new Error('renderTicks: tickMs must be positive');
    const total = Math.round(durationMs * chip.sampleRate / 1000);
    const samples = new Float32Array(total);
    let frames = 0;
    while (frames < total) {
        chip.controls.update(tickMs);
        onTick(tickMs);
        const target = Math.min(total, Math.round(chip.audio80.time * chip.sampleRate / 1000));
        if (target <= frames) continue;
        chip.render(samples.subarray(frames, target));
        frames = target;
    }
    return samples;
}

/**
 * A short hash of rendered sound, to compare with one recorded earlier. It
 * hashes the samples rounded to 16 bits, as a WAV file holds them. So a
 * difference too small to survive in a WAV file does not count.
 */
export function hashSamples(samples: Float32Array): string {
    let hash = FNV_OFFSET;
    for (let i = 0; i < samples.length; i++) hash = mix(hash, toInt16(samples[i]));
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Finds a module's songs and sound effects, with the names it exports them under. Tests and scripts use it to go through every sound. */
export function findSounds(exports: Readonly<Record<string, unknown>>): ModuleSounds {
    const songs: [string, Song][] = [];
    const effects: [string, SoundEffect][] = [];
    for (const name of Object.keys(exports)) {
        const value = exports[name];
        if (isSong(value)) songs.push([name, value]);
        else if (isSoundEffect(value)) effects.push([name, value]);
    }
    return { songs, effects };
}

/** The peak level of rendered sound, from 0 to 1, or more if it clips. */
export function measurePeak(samples: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
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

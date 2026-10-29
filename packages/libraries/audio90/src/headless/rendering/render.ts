import { type Audio80Character, createAudio80SongDriver, isAudio80Sound, type Audio80Song, type Audio80Sound } from '../../audio80';
import { type Audio90Character, type Audio90Song, type Audio90Sound, createAudio90SongDriver, isAudio90Sound } from '../../audio90';
import { createSongPlayer } from '../../shared';
import { type Audio80Renderer, createAudio80Renderer } from './audio80-renderer';
import { type Audio90Renderer, createAudio90Renderer } from './audio90-renderer';
import { DEFAULT_SAMPLE_RATE } from '../headless-chip';
import { type RenderedSamples, type StereoSamples } from '../rendered-samples';

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
            const renderer = createAudio90Renderer({ sampleRate, character: (options as Audio90RenderOptions).character });
            renderer.writer.play(songOrSound);
            const durationMs = options.durationMs ?? songOrSound.data.lengthMs + songOrSound.data.envelope.releaseMs + TAIL_MS;
            return renderStereo(renderer, { sampleRate, durationMs, tickMs, onTick: ignore });
        }
        const renderer = createAudio80Renderer({ sampleRate, character: (options as Audio80RenderOptions).character });
        renderer.writer.play(songOrSound);
        const durationMs = options.durationMs ?? songOrSound.data.lengthMs + songOrSound.data.releaseMs + TAIL_MS;
        return renderMono(renderer, { sampleRate, durationMs, tickMs, onTick: ignore });
    }
    const song = songOrSound;
    const passMs = song.durationMs;
    const durationMs = options.durationMs ?? passMs + TAIL_MS;
    if (song.chip === 'audio90') {
        const renderer = createAudio90Renderer({ sampleRate, character: (options as Audio90RenderOptions).character });
        const player = createSongPlayer({ driver: createAudio90SongDriver(renderer.writer) });
        player.play(song);
        return renderStereo(renderer, {
            sampleRate,
            durationMs,
            tickMs,
            onTick(deltaMs) {
                // Render one pass. A looping song is stopped where it would start again, before that tick's notes are written
                if (song.loop >= 0 && renderer.writer.time >= passMs) player.stop();
                player.update(deltaMs);
            },
        });
    }
    const renderer = createAudio80Renderer({ sampleRate, character: (options as Audio80RenderOptions).character });
    const player = createSongPlayer({ driver: createAudio80SongDriver(renderer.writer) });
    player.play(song);
    return renderMono(renderer, {
        sampleRate,
        durationMs,
        tickMs,
        onTick(deltaMs) {
            if (song.loop >= 0 && renderer.writer.time >= passMs) player.stop();
            player.update(deltaMs);
        },
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_TICK_MS = 1000 / 60;

/** How long to render after a sound ends, so its release and echo can die away. */
const TAIL_MS = 600;

/** How long to render, and how: the ticks it moves on by, and what each tick plays. */
interface TickedRender {
    readonly sampleRate: number;
    readonly durationMs: number;
    readonly tickMs: number;
    /** Called after the clock moves on by each tick, as a song player is. */
    readonly onTick: (deltaMs: number) => void;
}

/** Renders an Audio80's one channel for as long as `ticked` says, a tick at a time. */
function renderMono(renderer: Audio80Renderer, ticked: TickedRender): Float32Array {
    const samples = new Float32Array(Math.round(ticked.durationMs * ticked.sampleRate / 1000));
    runTicks(renderer.writer, ticked, samples.length, (from, to) => renderer.render(samples.subarray(from, to), 1));
    return samples;
}

/** Renders an Audio90's two channels for as long as `ticked` says, a tick at a time. */
function renderStereo(renderer: Audio90Renderer, ticked: TickedRender): StereoSamples {
    const total = Math.round(ticked.durationMs * ticked.sampleRate / 1000);
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    runTicks(renderer.writer, ticked, total, (from, to) => renderer.render(left.subarray(from, to), right.subarray(from, to), 1));
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

function ignore(): void {
    // Nothing to do each tick
}

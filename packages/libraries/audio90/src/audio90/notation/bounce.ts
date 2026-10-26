import { COMMAND_STRIDE } from '../../shared';
import { createAudio90Synthesiser } from '../synthesiser';
import { createCommandAudio90 } from '../chip';
import type { Audio90Song } from './song';
import { createAudio90ChannelState, releaseAudio90Song, writeAudio90Row, writeAudio90SongStart } from './song-writer';

// Bouncing: playing a song on the Audio90's own engines, in memory, and
// keeping what it renders as a sample. Every sample the chip plays is made
// this way, on the main thread, as the entry loads.

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What to bounce, and how to keep it. */
export interface BounceOptions {
    /** The song to play. It plays once, from its start. */
    readonly song: Audio90Song;
    /** The sample's own rate, in Hz, at which the song is rendered. */
    readonly sampleRate: number;
    /** How many bits each sample keeps: 8, 12 or 16. */
    readonly bits: number;
    /** How long to render, in ms. */
    readonly lengthMs: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Plays `song` once and renders it, mixed to mono, with its peak at 90% of
 * full scale, rounded to `bits`. The bounce is dry: the reverb, echo and
 * chorus are silent unless the song sets them, since the chip adds its own
 * when the sample plays. The same song always bounces to the same samples.
 */
export function bounceAudio90Song(options: BounceOptions): Int16Array {
    const { song, sampleRate, bits } = options;
    // With no effect of its own, the song's bounce is dry, so its effects need not run at all
    const hasEffects = song.reverb !== undefined || song.echo !== undefined || song.chorus !== undefined;
    const synthesiser = createAudio90Synthesiser({ sampleRate, character: song.character, queueCapacity: QUEUE_CAPACITY, hasEffects });
    const writer = createCommandAudio90({
        onInstrument: (id, data) => synthesiser.defineInstrument(id, data),
        onEffect: (id, data) => synthesiser.defineEffect(id, data),
        onSample: (id, data) => synthesiser.defineSample(id, data),
    });
    writer.setEffect('reverb', 'level', 0, 0);
    writer.setEffect('echo', 'level', 0, 0);
    writer.setEffect('chorus', 'level', 0, 0);
    const state = createAudio90ChannelState();
    writeAudio90SongStart(writer, song, state, 0, 1);

    const rowMs = 60000 / (song.bpm * song.rowsPerBeat);
    const swingMs = song.swing * rowMs;
    let gridMs = 0;
    for (let orderIndex = 0; orderIndex < song.order.length; orderIndex++) {
        const rowCount = song.patterns[song.order[orderIndex].pattern].rowCount;
        for (let row = 0; row < rowCount; row++) {
            // An odd row is late by the swing. A row lasts until the next starts, and the next pattern's first row is never late
            const delayMs = row % 2 === 1 ? swingMs : 0;
            const nextDelayMs = row + 1 < rowCount && row % 2 === 0 ? swingMs : 0;
            writeAudio90Row(writer, song, state, orderIndex, row, gridMs + delayMs, rowMs + nextDelayMs - delayMs, 1);
            gridMs += rowMs;
        }
    }
    releaseAudio90Song(writer, song, gridMs);

    const frames = Math.max(1, Math.round(options.lengthMs * sampleRate / 1000));
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    const msPerSample = 1000 / sampleRate;
    // Queued a block at a time, so the queue never fills, however long the song
    let sent = 0;
    for (let at = 0; at < frames; at += BLOCK) {
        const blockEndMs = (at + BLOCK) * msPerSample;
        let count = 0;
        while (sent + count < writer.count && writer.commands[(sent + count) * COMMAND_STRIDE + 1] < blockEndMs && count < QUEUE_CAPACITY / 2) count++;
        if (count > 0) synthesiser.enqueue(writer.commands.subarray(sent * COMMAND_STRIDE), count);
        sent += count;
        synthesiser.render(left, right, at, Math.min(BLOCK, frames - at), at * msPerSample, msPerSample);
    }
    return toSampleData(left, right, bits);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BLOCK = 128;
const QUEUE_CAPACITY = 4096;
/** The level a bounce's peak is brought to, as a share of full scale. */
const PEAK = 0.9;

/** Mixes two channels to mono, brings the peak to `PEAK`, and rounds each sample to `bits`. */
function toSampleData(left: Float32Array, right: Float32Array, bits: number): Int16Array {
    const frames = left.length;
    let peak = 0;
    for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i] + right[i]) * 0.5);
    const scale = peak > 0 ? PEAK / peak : 0;
    const steps = (1 << (bits - 1)) - 1;
    const shift = 1 << (16 - bits);
    const data = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
        const x = (left[i] + right[i]) * 0.5 * scale;
        data[i] = Math.max(-32768, Math.min(32767, Math.round(x * steps) * shift));
    }
    return data;
}

import { listChannels, type RenderedSamples } from './stereo-samples';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Encodes rendered sound as a 16-bit WAV file: mono for one channel, stereo for two. */
export function encodeWav(samples: RenderedSamples, sampleRate: number): Uint8Array {
    const channels = listChannels(samples);
    const channelCount = channels.length;
    const frames = channels[0].length;
    const frameBytes = channelCount * 2;
    const dataBytes = frames * frameBytes;
    const bytes = new Uint8Array(44 + dataBytes);
    const view = new DataView(bytes.buffer);
    writeText(bytes, 0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeText(bytes, 8, 'WAVE');
    writeText(bytes, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, channelCount, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * frameBytes, true); // bytes a second
    view.setUint16(32, frameBytes, true); // bytes a frame
    view.setUint16(34, 16, true);
    writeText(bytes, 36, 'data');
    view.setUint32(40, dataBytes, true);
    // Each frame holds one sample of each channel, left first
    for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channelCount; c++) view.setInt16(44 + i * frameBytes + c * 2, toInt16(channels[c][i]), true);
    }
    return bytes;
}

/** Converts a sample from -1 to 1 to the 16-bit integer a WAV file holds. It rounds the sample and clips it to the integer's range. */
export function toInt16(x: number): number {
    return Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function writeText(bytes: Uint8Array, at: number, text: string): void {
    for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i);
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Encodes rendered sound as a 16-bit mono WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
    const frames = samples.length;
    const dataBytes = frames * 2;
    const bytes = new Uint8Array(44 + dataBytes);
    const view = new DataView(bytes.buffer);
    writeText(bytes, 0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeText(bytes, 8, 'WAVE');
    writeText(bytes, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // bytes a second
    view.setUint16(32, 2, true); // bytes a frame
    view.setUint16(34, 16, true);
    writeText(bytes, 36, 'data');
    view.setUint32(40, dataBytes, true);
    for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, toInt16(samples[i]), true);
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

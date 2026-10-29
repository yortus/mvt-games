import { toInt16 } from './encode-wav';
import type { RenderedSamples } from './stereo-samples';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

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

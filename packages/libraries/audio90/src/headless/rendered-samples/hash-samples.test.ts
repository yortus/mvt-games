import { describe, expect, it } from 'vitest';
import { hashSamples } from './hash-samples';

describe('hashSamples', () => {
    it('hashes stereo sound a frame at a time, so swapping the channels changes the hash', () => {
        const a = createRamp(64, 0.5);
        const b = createRamp(64, -0.25);
        expect(hashSamples({ left: a, right: b })).not.toBe(hashSamples({ left: b, right: a }));
        expect(hashSamples({ left: a, right: b })).toBe(hashSamples({ left: a.slice(), right: b.slice() }));
    });
});

/** `length` samples rising evenly from 0 to `peak`. */
function createRamp(length: number, peak: number): Float32Array {
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) samples[i] = peak * (i + 1) / length;
    return samples;
}

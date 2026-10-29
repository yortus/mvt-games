import { describe, expect, it } from 'vitest';
import { measurePeak } from './measure-peak';

describe('measurePeak', () => {
    it('measures the peak of the louder channel of stereo sound', () => {
        expect(measurePeak({ left: createRamp(64, 0.25), right: createRamp(64, -0.75) })).toBeCloseTo(0.75, 6);
    });
});

/** `length` samples rising evenly from 0 to `peak`. */
function createRamp(length: number, peak: number): Float32Array {
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) samples[i] = peak * (i + 1) / length;
    return samples;
}

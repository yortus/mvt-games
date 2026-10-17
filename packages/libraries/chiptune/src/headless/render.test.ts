import { describe, expect, it } from 'vitest';
import { createAudio90SoundEffect, HELD_ENVELOPE } from '../audio90';
import { encodeWav, toInt16 } from './encode-wav';
import { createHeadlessAudio80 } from './headless-audio80';
import { hashSamples, measurePeak, renderSoundEffect, renderTicks } from './render';

describe('renderTicks', () => {
    for (const tickMs of [0, -1, NaN]) {
        it(`refuses a tick of ${tickMs} ms, which would never reach the end`, () => {
            expect(() => renderTicks(createHeadlessAudio80({ render: true }), 100, tickMs, () => undefined)).toThrow('tickMs must be positive');
        });
    }
});

describe('the render tools, with stereo sound', () => {
    it('render an Audio90 effect in two channels, at its own pan', () => {
        const effect = createAudio90SoundEffect({ oscillator: { wave: 'saw' }, envelope: HELD_ENVELOPE, note: 'C-5', lengthMs: 100, pan: -1 });
        const { left, right } = renderSoundEffect(effect, { durationMs: 200 });
        expect(left.length).toBe(9600);
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(measurePeak(right)).toBeLessThan(1e-6);
    });

    it('hash a frame at a time, so swapping the channels changes the hash', () => {
        const a = createRamp(64, 0.5);
        const b = createRamp(64, -0.25);
        expect(hashSamples({ left: a, right: b })).not.toBe(hashSamples({ left: b, right: a }));
        expect(hashSamples({ left: a, right: b })).toBe(hashSamples({ left: a.slice(), right: b.slice() }));
    });

    it('measure the peak of the louder channel', () => {
        expect(measurePeak({ left: createRamp(64, 0.25), right: createRamp(64, -0.75) })).toBeCloseTo(0.75, 6);
    });

    it('encode a WAV file with two channels, a frame at a time, the left first', () => {
        const left = Float32Array.of(0.5, -0.5);
        const right = Float32Array.of(0.25, 1);
        const view = new DataView(encodeWav({ left, right }, 32000).buffer);
        // The channel count, the bytes a second, the bytes a frame and the data's length
        expect([view.getUint16(22, true), view.getUint32(28, true), view.getUint16(32, true), view.getUint32(40, true)]).toEqual([2, 128000, 4, 8]);
        expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true), view.getInt16(50, true)]).toEqual([toInt16(0.5), toInt16(0.25), toInt16(-0.5), toInt16(1)]);
    });
});

/** `length` samples rising evenly from 0 to `peak`. */
function createRamp(length: number, peak: number): Float32Array {
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) samples[i] = peak * (i + 1) / length;
    return samples;
}

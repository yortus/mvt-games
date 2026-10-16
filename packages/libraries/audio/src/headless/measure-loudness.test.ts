import { describe, expect, it } from 'vitest';
import { measureLoudness } from './measure-loudness';

const SAMPLE_RATE = 48000;

describe('measureLoudness', () => {
    it('measures a 1 kHz tone at its level in dBFS, as BS.1770 calibrates a tone heard on both speakers', () => {
        const amplitude = 0.1;
        expect(measureLoudness(createTone(amplitude, 3), SAMPLE_RATE)).toBeCloseTo(20 * Math.log10(amplitude), 1);
    });

    it('measures the same tone the same at 44.1 kHz', () => {
        const amplitude = 0.1;
        expect(measureLoudness(createTone(amplitude, 3, 44100), 44100)).toBeCloseTo(20 * Math.log10(amplitude), 1);
    });

    it('rises 6 LU with twice the amplitude', () => {
        expect(measureLoudness(createTone(0.2, 3), SAMPLE_RATE) - measureLoudness(createTone(0.1, 3), SAMPLE_RATE)).toBeCloseTo(20 * Math.log10(2), 1);
    });

    it('leaves silence out, so more silence after a tone does not change it', () => {
        const sound = createTone(0.1, 3);
        expect(measureLoudness(padWithSilence(sound, 4), SAMPLE_RATE)).toBeCloseTo(measureLoudness(padWithSilence(sound, 2), SAMPLE_RATE), 6);
    });

    it('leaves out passages more than 10 LU quieter than the rest, as it leaves out silence', () => {
        const loud = createTone(0.1, 3);
        // At -60 dBFS, this is above the absolute gate. Only near silence, under -70, fails that gate
        const quiet = createTone(0.001, 3);
        expect(measureLoudness(quiet, SAMPLE_RATE)).toBeGreaterThan(-Infinity);
        expect(measureLoudness(joinSamples(loud, quiet), SAMPLE_RATE)).toBeCloseTo(measureLoudness(padWithSilence(loud, 2), SAMPLE_RATE), 3);
    });

    it('measures silence as -Infinity', () => {
        expect(measureLoudness(new Float32Array(SAMPLE_RATE), SAMPLE_RATE)).toBe(-Infinity);
    });
});

/** Creates a 997 Hz sine wave of `amplitude`, lasting `seconds`. It is BS.1770's own test tone. */
function createTone(amplitude: number, seconds: number, sampleRate = SAMPLE_RATE): Float32Array {
    const samples = new Float32Array(Math.round(seconds * sampleRate));
    for (let i = 0; i < samples.length; i++) samples[i] = amplitude * Math.sin(2 * Math.PI * 997 * i / sampleRate);
    return samples;
}

/** `sound` followed by silence, making `times` its length in all. */
function padWithSilence(sound: Float32Array, times: number): Float32Array {
    const samples = new Float32Array(sound.length * times);
    samples.set(sound);
    return samples;
}

/** `first` followed by `second`. */
function joinSamples(first: Float32Array, second: Float32Array): Float32Array {
    const samples = new Float32Array(first.length + second.length);
    samples.set(first);
    samples.set(second, first.length);
    return samples;
}

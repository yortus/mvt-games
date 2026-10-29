import { describe, expect, it } from 'vitest';
import { render } from '../../headless';
import { toFrequency } from '../../shared';
import { AUDIO90_SAMPLE_MEMORY } from '../synthesiser';
import { createAudio90Sample, prepareAudio90Samples } from './audio90-sample';
import { createAudio90Song } from './audio90-song';
import { createAudio90Sound } from './audio90-sound';
import { createToneSong } from './tone-song.test-support';

describe('samples', () => {
    it('bounce a song at their own rate, with the song\'s pitch, peaking at 90% of full scale', () => {
        const sample = createAudio90Sample({ bounce: createToneSong('A-4', 8), rate: 16000, rootNote: 'A-4' });
        const { data } = sample;
        expect(data.data.length).toBe(Math.round(createToneSong('A-4', 8).durationMs * 16000 / 1000));
        expect(sample.length).toBe(data.data.length);
        expect(measureHz(data.data, 16000)).toBeCloseTo(toFrequency(69), -1);
        expect(measureInt16Peak(data.data)).toBeCloseTo(0.9, 2);
        expect(data.rootNote).toBe(69);
    });

    it('bounce the same song to the same samples every time', () => {
        const song = createToneSong('C-4', 4);
        expect(createAudio90Sample({ bounce: song }).data.data).toEqual(createAudio90Sample({ bounce: song }).data.data);
    });

    it('keep only the bits asked for', () => {
        const { data } = createAudio90Sample({ bounce: createToneSong('C-4', 4), bits: 8 }).data;
        expect(data.every((value) => value % 256 === 0)).toBe(true);
    });

    it('bounce dry, unless the song sets an effect', () => {
        const wet = createAudio90Sound({ engine: 'fm', operators: [{}], reverb: 1, envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 5 } });
        const options = { bpm: 120, instruments: { W: wet }, patterns: { p: '| C-4 W\n| ===\n| ...\n| ...' }, order: ['p'] };
        const dry = createAudio90Sample({ bounce: createAudio90Song(options) }).data.data;
        const roomy = createAudio90Sample({ bounce: createAudio90Song({ ...options, reverb: { level: 1 } }) }).data.data;
        // The last row, after the note's release, is silent when dry and rings with the reverb
        const lastRow = (data: Int16Array) => measureInt16Peak(data.subarray(Math.floor(data.length * 3 / 4)));
        expect(lastRow(dry)).toBeLessThan(0.001);
        expect(lastRow(roomy)).toBeGreaterThan(0.01);
    });

    it('play in a sample sound at the pitch of the note played against their root', () => {
        const sample = createAudio90Sample({ bounce: createToneSong('A-4', 16), rootNote: 'A-4', loop: { fromMs: 100, toMs: 900 } });
        const sampler = createAudio90Sound({ engine: 'sample', sample, note: 'A-5', lengthMs: 400 });
        const { left } = render(sampler, { durationMs: 400 });
        expect(measureHz(left.subarray(4800), 48000)).toBeCloseTo(toFrequency(81), -1);
    });

    it('check their loop, slices, rate and bits', () => {
        const bounce = createToneSong('C-4', 4);
        expect(() => createAudio90Sample({ bounce, slices: 4, loop: { fromMs: 0, toMs: 100 } })).toThrow('a sliced sample cannot loop');
        expect(() => createAudio90Sample({ bounce, lengthMs: 200, loop: { fromMs: 100, toMs: 300 } })).toThrow('is not a part of the sample');
        expect(() => createAudio90Sample({ bounce, rate: 44100 })).toThrow('sample: rate: 44100 is not 8000 to 32000');
        expect(() => createAudio90Sample({ bounce, bits: 10 as 8 })).toThrow('sample: bits: 10 is not one of 8, 12, 16');
    });

    it('refuse to prepare more than the chip\'s sample memory, before bouncing any', () => {
        const bounce = createToneSong('C-4', 4);
        const rate = 32000;
        const half = createAudio90Sample({ bounce, rate, lengthMs: (AUDIO90_SAMPLE_MEMORY / 2 + 1) * 1000 / rate });
        expect(() => prepareAudio90Samples([half, half])).toThrow(`more than the chip's ${AUDIO90_SAMPLE_MEMORY}`);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The frequency of a steady tone, from how often it crosses zero going up. */
function measureHz(samples: ArrayLike<number>, sampleRate: number): number {
    let crossings = 0;
    let first = -1;
    let last = -1;
    for (let i = 1; i < samples.length; i++) {
        if (samples[i - 1] < 0 && samples[i] >= 0) {
            if (first < 0) first = i;
            last = i;
            crossings++;
        }
    }
    return crossings > 1 ? (crossings - 1) * sampleRate / (last - first) : 0;
}

function measureInt16Peak(data: Int16Array): number {
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    return peak / 32767;
}

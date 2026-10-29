import { describe, expect, it } from 'vitest';
import { MAX_ARPEGGIO, toNoteNumber } from '../../shared';
import { toCutoff, toWaveFlags } from '../synthesiser';
import { createAudio80Sound, isAudio80Sound } from './audio80-sound';

const LEAD = createAudio80Sound({ wave: 'pulse' });

describe('tracker notation: sounds', () => {
    it('reads a step table, one step from each line, skipping blank lines and comment lines', () => {
        const steps = `
            # wave     pitch  vol  width  cutoff
            noise      +24    vF

            triangle   -12         p4     f8
            C-5
        `;
        const sound = createAudio80Sound({ steps });
        expect(sound.data.steps).toHaveLength(3);
        const [first, second, third] = sound.data.steps;
        expect(first).toMatchObject({ wave: toWaveFlags('noise'), pitchMode: 'relative', pitch: 24, volume: 1 });
        expect(second).toMatchObject({ wave: toWaveFlags('triangle'), pitch: -12, pulseWidth: 4 / 16, cutoffHz: toCutoff(8) });
        expect(third).toMatchObject({ wave: -1, pitchMode: 'absolute', pitch: toNoteNumber('C-5') });
    });

    it('ignores a comment at the end of a step, but reads a # inside a token as part of it', () => {
        const steps = `
            noise      +24    # the click
            C#5               # an exact note
        `;
        const [first, second] = createAudio80Sound({ steps }).data.steps;
        expect(first).toMatchObject({ wave: toWaveFlags('noise'), pitch: 24 });
        expect(second).toMatchObject({ pitchMode: 'absolute', pitch: toNoteNumber('C#5') });
        expect(() => createAudio80Sound({ steps: 'noise#x' })).toThrow("step 0: 'noise#x' is not a wave");
    });

    it('rejects a line that starts with //, which is not a comment', () => {
        expect(() => createAudio80Sound({ steps: '// wave\npulse' })).toThrow("step 0: '//' is not a wave");
    });

    it('says which step is wrong, counting only the lines that are steps', () => {
        const steps = `
            # wave
            pulse

            pulse sine
        `;
        expect(() => createAudio80Sound({ steps })).toThrow("step 1: 'sine' is not a wave");
        expect(() => createAudio80Sound({ steps: 'pulse saw' })).toThrow('step 0: two waves');
        expect(() => createAudio80Sound({ steps: 'pulse\nB#9' })).toThrow("step 1: 'B#9' is above G-9, the highest note");
    });

    it('rejects a note above the highest', () => {
        expect(() => createAudio80Sound({ note: 'B#9' })).toThrow("sound: note: 'B#9' is above G-9, the highest note");
        expect(() => createAudio80Sound({ glideTo: 'H-4' })).toThrow("sound: glideTo: 'H-4' is not a note");
    });

    it('reads a wavetable, and rejects one of the wrong length', () => {
        const table = '0123 4567 89AB CDEF FEDC BA98 7654 3210';
        expect(createAudio80Sound({ wave: 'wavetable', wavetable: table }).data.wavetable).toHaveLength(32);
        expect(() => createAudio80Sound({ wavetable: '0123' })).toThrow('32 hex digits');
    });

    it('rejects an arpeggio longer than the chip holds', () => {
        const longest = new Array<number>(MAX_ARPEGGIO).fill(0);
        expect(createAudio80Sound({ arpeggio: longest }).data.arpeggio).toHaveLength(MAX_ARPEGGIO);
        expect(() => createAudio80Sound({ arpeggio: [...longest, 0] }))
            .toThrow(`sound: an arpeggio has at most ${MAX_ARPEGGIO} notes; this one has ${MAX_ARPEGGIO + 1}`);
    });

    it('rejects a filter sweep from or to 0 Hz', () => {
        expect(() => createAudio80Sound({ filterSweep: { fromHz: 0, toHz: 2000, ms: 100 } })).toThrow("sound: a filter sweep's fromHz and toHz must be above 0");
        expect(() => createAudio80Sound({ filterSweep: { fromHz: 2000, toHz: 0, ms: 100 } })).toThrow("a filter sweep's fromHz and toHz must be above 0");
        expect(createAudio80Sound({ filterSweep: { fromHz: 200, toHz: 2000, ms: 100 } }).data.filterSweepToHz).toBe(2000);
    });

    it('rejects a pulse width, or a width to sweep to, outside 0 to 1', () => {
        for (const width of [-0.1, 2, Number.NaN]) {
            expect(() => createAudio80Sound({ pulseWidth: width }), `pulseWidth ${width}`).toThrow(`sound: pulseWidth must be 0 to 1; got ${width}`);
            expect(() => createAudio80Sound({ pulseSweep: { to: width, ms: 100 } }), `pulseSweep.to ${width}`).toThrow(`sound: pulseSweep.to must be 0 to 1; got ${width}`);
        }
        expect(createAudio80Sound({ pulseWidth: 0.1, pulseSweep: { to: 0.9, ms: 100 } }).data.pulseSweepTo).toBe(0.9);
    });

    it('lasts as long as its step table by default, or 250 ms with none', () => {
        const stepMs = 20;
        const steps = `
            pulse C-6
            pulse C-5
            pulse C-4
        `;
        expect(createAudio80Sound({ stepMs, steps }).data.lengthMs).toBe(3 * stepMs);
        expect(createAudio80Sound({}).data.lengthMs).toBe(250);
    });

    it('plays C-4 when played with no note, unless it names its own', () => {
        expect(createAudio80Sound({}).data.note).toBe(toNoteNumber('C-4'));
        expect(createAudio80Sound({ note: 'C-2' }).data.note).toBe(toNoteNumber('C-2'));
    });

    it('takes a priority and a number of voices to play on, at least 1', () => {
        expect(createAudio80Sound({}).data).toMatchObject({ priority: 0, maxVoices: 1, glideTo: Number.NaN });
        expect(createAudio80Sound({ priority: 2, maxVoices: 0 }).data).toMatchObject({ priority: 2, maxVoices: 1 });
    });

    it('rejects a length of 0 or less', () => {
        expect(() => createAudio80Sound({ lengthMs: 0 })).toThrow('sound: lengthMs must be above 0; got 0');
        expect(() => createAudio80Sound({ lengthMs: -10 })).toThrow('sound: lengthMs must be above 0; got -10');
    });

    it('knows a sound it made', () => {
        expect(isAudio80Sound(LEAD)).toBe(true);
        expect(isAudio80Sound({ ...LEAD })).toBe(false);
    });
});

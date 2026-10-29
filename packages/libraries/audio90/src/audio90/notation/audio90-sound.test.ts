import { describe, expect, it } from 'vitest';
import { ENGINE_FM, FILTER90_LOWPASS_24, LFO_SQUARE, WAVE90_PULSE } from '../synthesiser';
import { type Audio90Sound, createAudio90Sound, isAudio90Sound } from './audio90-sound';

const STAB: Audio90Sound = createAudio90Sound({ oscillator: { wave: 'saw', unison: 3, detune: 0.2 }, filter: { cutoffHz: 3000, accent: 0.5 } });

describe('sounds', () => {
    it('reads an FM algorithm as which operators modulate which, and hears the rest', () => {
        const keys = createAudio90Sound({ engine: 'fm', algorithm: '2>1 4>3', operators: [{}, {}, {}, {}] });
        expect([keys.engine, STAB.engine]).toEqual(['fm', 'analog']);
        // Operator 2 (bit 1) modulates operator 1, and operator 4 (bit 3) modulates operator 3
        expect(keys.data.algorithm).toEqual([0b0010, 0, 0b1000, 0]);
        const stack = createAudio90Sound({ engine: 'fm', algorithm: '3+2>1', operators: [{}, {}, {}] });
        expect(stack.data.algorithm[0]).toBe(0b0110);
        expect(keys.data.engine).toBe(ENGINE_FM);
    });

    it('gives each operator the sound\'s release unless it has an envelope of its own', () => {
        const sound = createAudio90Sound({
            engine: 'fm',
            envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
            operators: [{}, { envelope: { attackMs: 0, decayMs: 100, sustain: 0, releaseMs: 50 } }],
        });
        expect(sound.data.operators[0].envelope).toEqual({ attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 });
        expect(sound.data.operators[1].envelope.releaseMs).toBe(50);
    });

    it('throws with the option\'s path for an operator ratio that is not a multiple of 0.5', () => {
        expect(() => createAudio90Sound({ engine: 'fm', operators: [{}, {}, {}, { ratio: 0.3 }] }))
            .toThrow('sound: operators[3].ratio: 0.3 is not a multiple of 0.5');
    });

    it('throws for an algorithm whose operator modulates a higher one, or one it does not have', () => {
        expect(() => createAudio90Sound({ engine: 'fm', algorithm: '1>2', operators: [{}, {}] })).toThrow('operator 1 cannot modulate operator 2');
        expect(() => createAudio90Sound({ engine: 'fm', algorithm: '3>1', operators: [{}, {}] })).toThrow('\'3\' is not one of its 2 operators');
    });

    it('throws for an option that belongs to another engine', () => {
        expect(() => createAudio90Sound({ engine: 'analog', operators: [{}] })).toThrow('operators is only for fm sounds, and this one is analog');
        expect(() => createAudio90Sound({ engine: 'sample' })).toThrow('a sample sound needs a sample');
    });

    it('sends a mod envelope to the pitch, the cutoff or the brightness, by the amount it gives', () => {
        const envelope = { attackMs: 0, decayMs: 180, sustain: 0, releaseMs: 0 };
        const squelch = createAudio90Sound({ filter: { cutoffHz: 350, resonance: 0.85, accent: 0.6 }, modEnvelope: { to: 'cutoff', amount: 3, envelope } });
        expect(squelch.data).toMatchObject({ filterMode: FILTER90_LOWPASS_24, cutoffHz: 350, modCutoff: 3, modPitch: 0, accent: 0.6 });
        expect(squelch.data.modEnvelope).toEqual(envelope);
        expect(createAudio90Sound({ modEnvelope: { to: 'pitch', amount: 24, envelope } }).data).toMatchObject({ modPitch: 24, modCutoff: 0 });
    });

    it('times an LFO in beats or in Hz, not both', () => {
        const gate = createAudio90Sound({ lfo: { shape: 'square', rateBeats: 1 / 4, volume: 1 } });
        expect(gate.data).toMatchObject({ lfoShape: LFO_SQUARE, lfoBeats: 0.25, lfoVolume: 1 });
        expect(() => createAudio90Sound({ lfo: { rateHz: 2, rateBeats: 1 } })).toThrow('give lfo.rateHz or lfo.rateBeats, not both');
    });

    it('makes a legato sound tie its notes, gliding over glideMs', () => {
        expect(createAudio90Sound({ glideMs: 60, isLegato: true }).data).toMatchObject({ isLegato: true, glideMs: 60 });
        expect(createAudio90Sound({ glideMs: 40 }).data).toMatchObject({ isLegato: false, glideMs: 40 });
    });

    it('reads a step table\'s Audio90 columns: wave, pitch, volume, pan, brightness and slice', () => {
        const sound = createAudio90Sound({ steps: `
            # wave  pitch  vol  pan  bright  slice
            pulse   +7     v6   P00  f9      s03
            ...
        `.replace('...', 'PFF') });
        expect(sound.data.steps[0]).toEqual({ pitchMode: 'relative', pitch: 7, volume: 6 / 15, pan: -1, brightness: 9 / 15, slice: 3, wave: WAVE90_PULSE });
        expect(sound.data.steps[1]).toMatchObject({ pitchMode: 'none', pan: 1, volume: -1, wave: -1 });
        expect(() => createAudio90Sound({ steps: 'v4 v5' })).toThrow('sound: step 0: two volumes');
    });

    it('checks each option\'s range, naming it', () => {
        expect(() => createAudio90Sound({ pan: 2 })).toThrow('sound: pan: 2 is not -1 to 1');
        expect(() => createAudio90Sound({ oscillator: { unison: 8 } })).toThrow('oscillator.unison: 8 is not a whole number from 0 to 7');
    });
});

describe('how a sound plays on its own', () => {
    it('keeps its note, length, glide, priority and voices for a play', () => {
        const sound = createAudio90Sound({ note: 'C-3', glideTo: 'C-2', lengthMs: 400, priority: 2, maxVoices: 3, pan: -0.5, reverb: 0.5 });
        expect(sound.data).toMatchObject({ note: 48, glideTo: 36, lengthMs: 400, priority: 2, maxVoices: 3, pan: -0.5, reverb: 0.5 });
    });

    it('lasts as long as its step table by default, or 250 ms with none', () => {
        expect(createAudio90Sound({ stepMs: 20, steps: 'v8\nv4\nv2' }).data.lengthMs).toBe(60);
        expect(createAudio90Sound({}).data).toMatchObject({ lengthMs: 250, priority: 0, maxVoices: 1, glideTo: Number.NaN });
    });

    it('rejects a length of 0 or less, and a bad glide', () => {
        expect(() => createAudio90Sound({ lengthMs: 0 })).toThrow('sound: lengthMs must be above 0; got 0');
        expect(() => createAudio90Sound({ glideTo: 'H-4' })).toThrow("sound: glideTo: 'H-4' is not a note");
    });

    it('knows a sound it made', () => {
        expect(isAudio90Sound(STAB)).toBe(true);
        expect(isAudio90Sound({ ...STAB })).toBe(false);
    });
});

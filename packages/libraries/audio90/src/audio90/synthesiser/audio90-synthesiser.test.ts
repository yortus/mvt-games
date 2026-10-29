import { describe, expect, it } from 'vitest';
import { COMMAND_STRIDE, OP_NOTE_OFF, OP_NOTE_ON, OP_PLAY, OP_PLAY_OPTIONS, OP_SET_VOICE, OP_STOP } from '../../shared';
import {
    AUDIO90_OSCILLATOR_BUDGET,
    AUDIO90_SAMPLE_MEMORY,
    type Audio90Synthesiser,
    type Audio90SynthesiserOptions,
    createAudio90Synthesiser,
} from './audio90-synthesiser';
import {
    AUDIO90_CHARACTERS,
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_COUNT,
    AUDIO90_VOICE_SETTING_INDEX,
    type Audio90Character,
    type Audio90EffectId,
    type Audio90EffectSetting,
    type Audio90VoiceSetting,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
} from './audio90-commands';
import {
    type Audio90SoundData,
    type Audio90SampleData,
    DEFAULT_AUDIO90_SOUND,
    ENGINE_ANALOG,
    ENGINE_FM,
    ENGINE_SAMPLE,
    FILTER90_LOWPASS_24,
    HELD_ENVELOPE,
    LFO_SQUARE,
    MAX_UNISON,
    OP_WAVE_SINE,
    WAVE90_SAW,
} from './audio90-sound-data';

describe('the Audio90 synthesiser', () => {
    describe('its engines', () => {
        it('plays an FM carrier at the note\'s pitch, as a pure tone', () => {
            const rig = createRig();
            rig.noteOn(0, rig.instrument(FM_SINE), 69);
            const { left } = rig.render(500);
            const tail = left.subarray(RATE / 4);
            expect(measurePitch(tail)).toBeCloseTo(440, -1);
            expect(measureTone(tail, 880)).toBeLessThan(measureTone(tail, 440) / 100);
        });

        it('adds overtones with a modulator, and brightness takes them away', () => {
            const rig = createRig();
            const id = rig.instrument(FM_TWO_OP);
            rig.noteOn(0, id, 57);
            const bright = rig.render(500).left.subarray(RATE / 4);
            expect(measurePitch(bright)).toBeCloseTo(220, -1);
            expect(measureTone(bright, 440)).toBeGreaterThan(measureTone(bright, 220) / 10);

            rig.setVoice(0, 'brightness', 0);
            const dim = rig.render(500).left.subarray(RATE / 4);
            expect(measureTone(dim, 440)).toBeLessThan(measureTone(dim, 220) / 100);
        });

        it('plays an analog saw at the note\'s pitch, with every harmonic', () => {
            const rig = createRig();
            rig.noteOn(0, rig.instrument({ engine: ENGINE_ANALOG, wave: WAVE90_SAW }), 57);
            const { left } = rig.render(500);
            const tail = left.subarray(RATE / 4);
            expect(measurePitch(tail)).toBeCloseTo(220, -1);
            // A saw's nth harmonic is 1/n of its fundamental
            expect(measureTone(tail, 440) / measureTone(tail, 220)).toBeCloseTo(0.5, 1);
        });

        it('spreads detuned copies across the stereo field', () => {
            const rig = createRig();
            const narrow = rig.instrument({ engine: ENGINE_ANALOG, wave: WAVE90_SAW, unison: 7, detune: 0.3 });
            const wide = rig.instrument({ engine: ENGINE_ANALOG, wave: WAVE90_SAW, unison: 7, detune: 0.3, spread: 1 });
            rig.noteOn(0, narrow, 57);
            const mono = rig.render(300);
            rig.noteOff(0);
            rig.render(300);
            rig.noteOn(1, wide, 57);
            const stereo = rig.render(300);
            expect(correlate(mono.left, mono.right)).toBeGreaterThan(0.999);
            expect(correlate(stereo.left.subarray(RATE / 10), stereo.right.subarray(RATE / 10))).toBeLessThan(0.9);
        });

        it('plays a whole chord from one voice, by chord memory', () => {
            const rig = createRig();
            rig.noteOn(0, rig.instrument({ engine: ENGINE_ANALOG, chord: [0, 4, 7] }), 57);
            const tail = rig.render(500).left.subarray(RATE / 4);
            const root = measureTone(tail, 220);
            expect(measureTone(tail, 220 * Math.pow(2, 4 / 12))).toBeGreaterThan(root / 2);
            expect(measureTone(tail, 220 * Math.pow(2, 7 / 12))).toBeGreaterThan(root / 2);
        });

        it('keeps the analog voices within the oscillator budget, and never silences a note for it', () => {
            const rig = createRig();
            const supersaw = rig.instrument({ engine: ENGINE_ANALOG, wave: WAVE90_SAW, unison: MAX_UNISON, detune: 0.3 });
            const voices = Math.ceil(AUDIO90_OSCILLATOR_BUDGET / MAX_UNISON) + 2;
            for (let v = 0; v < voices; v++) rig.noteOn(v, supersaw, 48 + v);
            rig.render(50);
            expect(rig.synth.oscillatorCount).toBeLessThanOrEqual(AUDIO90_OSCILLATOR_BUDGET + voices);
            expect(rig.synth.oscillatorCount).toBeGreaterThanOrEqual(AUDIO90_OSCILLATOR_BUDGET);
            for (let v = 0; v < voices; v++) expect(rig.synth.isSounding(v), `voice ${v}`).toBe(true);
        });

        it('plays a sample at its root note, and an octave up at 12 semitones above', () => {
            const rig = createRig();
            rig.sample(1, sineSample(220, 32000, 57));
            const id = rig.instrument({ engine: ENGINE_SAMPLE, sample: 1 });
            rig.noteOn(0, id, 57);
            expect(measurePitch(rig.render(300).left.subarray(RATE / 10))).toBeCloseTo(220, -1);
            rig.noteOn(0, id, 69);
            expect(measurePitch(rig.render(300).left.subarray(RATE / 10))).toBeCloseTo(440, -1);
        });

        it('ends a one-shot sample at its end, and loops a looping one', () => {
            const rig = createRig();
            const oneShot = sineSample(220, 32000, 57, 3200);
            rig.sample(1, oneShot);
            rig.sample(2, { ...oneShot, loopStart: 1600, loopEnd: 3200 });
            rig.noteOn(0, rig.instrument({ engine: ENGINE_SAMPLE, sample: 1 }), 57);
            rig.noteOn(1, rig.instrument({ engine: ENGINE_SAMPLE, sample: 2 }), 57);
            rig.render(200);
            // 3200 samples at 32 kHz last 100 ms
            expect(rig.synth.isSounding(0)).toBe(false);
            expect(rig.synth.isSounding(1)).toBe(true);
        });

        it('plays the slice of a sample it is told to', () => {
            const rig = createRig();
            // Two slices: a 220 Hz tone, then a 440 Hz one
            const low = sineSample(220, 32000, 57, 16000).data;
            const high = sineSample(440, 32000, 57, 16000).data;
            const both = new Int16Array(32000);
            both.set(low);
            both.set(high, 16000);
            rig.sample(1, { data: both, sampleRate: 32000, rootNote: 57, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 2 });
            const id = rig.instrument({ engine: ENGINE_SAMPLE, sample: 1 });
            rig.noteOn(0, id, 57);
            rig.setVoice(0, 'slice', 1);
            expect(measurePitch(rig.render(200).left.subarray(RATE / 20))).toBeCloseTo(440, -1);
        });

        it('plays a sample backwards when it is reversed', () => {
            const rig = createRig();
            // A ramp up; backwards, it ramps down
            const ramp = new Int16Array(4800);
            for (let i = 0; i < ramp.length; i++) ramp[i] = Math.round(i / ramp.length * 20000);
            rig.sample(1, { data: ramp, sampleRate: RATE, rootNote: 60, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 });
            rig.noteOn(0, rig.instrument({ engine: ENGINE_SAMPLE, sample: 1, isReversed: true }), 60);
            const { left } = rig.render(100);
            expect(left[100]).toBeGreaterThan(left[4000]);
        });
    });

    describe('its filter, envelopes and LFO', () => {
        it('rings at its cutoff when a 24 dB filter\'s resonance is near full', () => {
            const rig = createRig();
            rig.noteOn(0, rig.instrument({
                engine: ENGINE_ANALOG, unison: 0, noise: 0.05, filterMode: FILTER90_LOWPASS_24, cutoffHz: 1000, resonance: 0.97,
            }), 60);
            const pitch = measurePitch(rig.render(500).left.subarray(RATE / 4));
            expect(pitch).toBeGreaterThan(800);
            expect(pitch).toBeLessThan(1100);
        });

        it('frees a voice whose sound decays to nothing, as a drum\'s does', () => {
            const rig = createRig();
            rig.noteOn(0, rig.instrument({ ...FM_SINE, envelope: { attackMs: 0, decayMs: 100, sustain: 0, releaseMs: 0 } }), 60);
            rig.render(50);
            expect(rig.synth.isSounding(0)).toBe(true);
            rig.render(200);
            expect(rig.synth.isSounding(0)).toBe(false);
        });

        it('ties a legato note into the one before: it glides, and its envelope runs on', () => {
            const rig = createRig();
            const slow = { attackMs: 400, decayMs: 0, sustain: 1, releaseMs: 50 };
            const legato = rig.instrument({ ...FM_SINE, envelope: slow, glideMs: 200, isLegato: true });
            rig.noteOn(0, legato, 45);
            const first = rig.render(300).left;
            rig.noteOn(0, legato, 57);
            const second = rig.render(100).left;
            // Had the envelope started again, the second note would start quieter than the first ended
            expect(measureRms(second.subarray(0, 960))).toBeGreaterThan(measureRms(first.subarray(first.length - 960)));
            // Just after the change, the pitch is still near the first note's
            expect(measurePitch(second.subarray(0, 2400))).toBeLessThan(160);
        });

        it('swings the volume with a square LFO timed in beats of the tempo', () => {
            const rig = createRig();
            rig.tempo(120);
            // Half a beat at 120 bpm is 250 ms: the volume dips for 125 ms of each 250
            rig.noteOn(0, rig.instrument({ ...FM_SINE, lfoShape: LFO_SQUARE, lfoBeats: 0.5, lfoVolume: 1 }), 69);
            const { left } = rig.render(1000);
            const levels = [];
            for (let ms = 0; ms < 1000; ms += 62.5) levels.push(measureRms(left.subarray(toFrames(ms + 10), toFrames(ms + 50))));
            const loud = Math.max(...levels);
            const quiet = Math.min(...levels);
            expect(quiet).toBeLessThan(loud / 10);
            // Loud for two windows of 62.5 ms, then quiet for two
            expect(levels.map((level) => level > loud / 2)).toEqual([true, true, false, false, true, true, false, false, true, true, false, false, true, true, false, false]);
        });

        it('holds an LFO timed in beats at a tempo of 0, as for a song held still', () => {
            const rig = createRig();
            rig.tempo(0);
            rig.noteOn(0, rig.instrument({ ...FM_SINE, lfoShape: LFO_SQUARE, lfoBeats: 0.5, lfoVolume: 1 }), 69);
            const { left } = rig.render(1000);
            const levels = [];
            for (let ms = 0; ms < 1000; ms += 62.5) levels.push(measureRms(left.subarray(toFrames(ms + 10), toFrames(ms + 50))));
            // The gate stays where it started, open, rather than swinging
            expect(Math.min(...levels)).toBeGreaterThan(Math.max(...levels) * 0.9);
        });

        it('opens an accented note\'s volume', () => {
            const rig = createRig();
            const id = rig.instrument({ ...FM_SINE, accent: 1 });
            rig.noteOn(0, id, 69);
            const plain = measureRms(rig.render(200).left.subarray(RATE / 20));
            rig.setVoice(0, 'accent', 1);
            const accented = measureRms(rig.render(200).left.subarray(RATE / 20));
            expect(accented / plain).toBeGreaterThan(1.2);
        });
    });

    describe('its stereo, effects and mix', () => {
        it('pans with constant power: hard left is silent on the right, and the centre is even', () => {
            const rig = createRig();
            const id = rig.instrument(FM_SINE);
            rig.noteOn(0, id, 69);
            rig.setVoice(0, 'pan', -1);
            const left = rig.render(200);
            expect(measureRms(left.right)).toBeLessThan(1e-6);
            rig.setVoice(0, 'pan', 0);
            const centre = rig.render(200);
            const side = measureRms(left.left.subarray(RATE / 20));
            expect(measureRms(centre.left.subarray(RATE / 20)) / side).toBeCloseTo(Math.SQRT1_2, 2);
        });

        it('echoes after its time, in ms or in beats of the tempo, and ping-pongs from left to right', () => {
            const rig = createRig();
            rig.setEffect('echo', 'level', 1);
            rig.setEffect('echo', 'feedback', 0.5);
            rig.setEffect('echo', 'pingPong', 1);
            rig.tempo(120);
            rig.setEffect('echo', 'timeBeats', 0.25);
            rig.noteOn(0, rig.instrument({ ...FM_SINE, echo: 1, envelope: { attackMs: 0, decayMs: 20, sustain: 0, releaseMs: 0 } }), 69);
            const { left, right } = rig.render(600);
            // A quarter of a beat at 120 bpm is 125 ms. The first repeat is on the left, the second on the right
            expect(measureRms(left.subarray(toFrames(125), toFrames(145)))).toBeGreaterThan(1e-3);
            const firstLeft = measureRms(left.subarray(toFrames(125), toFrames(145)));
            expect(measureRms(right.subarray(toFrames(125), toFrames(145)))).toBeLessThan(firstLeft / 10);
            expect(measureRms(right.subarray(toFrames(250), toFrames(270)))).toBeGreaterThan(1e-3);
            // Between the sound and its first repeat, there is only the output's slow settling, far below the repeat
            expect(measureRms(left.subarray(toFrames(60), toFrames(110)))).toBeLessThan(firstLeft / 10);
        });

        it('lets the reverb fade over its decay time', () => {
            const rig = createRig();
            rig.setEffect('reverb', 'level', 1);
            rig.setEffect('reverb', 'decayMs', 1000);
            rig.noteOn(0, rig.instrument({ ...FM_SINE, reverb: 1, envelope: { attackMs: 0, decayMs: 50, sustain: 0, releaseMs: 0 } }), 69);
            const { left } = rig.render(2500);
            const early = measureRms(left.subarray(toFrames(200), toFrames(300)));
            const late = measureRms(left.subarray(toFrames(1200), toFrames(1300)));
            // 60 dB down over 1000 ms, so 1000 ms later it is about 1000 times quieter
            expect(early).toBeGreaterThan(1e-3);
            expect(late).toBeLessThan(early / 300);
        });

        it('ducks the music on each note of the pump\'s voice, and lets it come back over the release', () => {
            const rig = createRig();
            rig.setEffect('pump', 'voice', 1);
            rig.setEffect('pump', 'depth', 0.8);
            rig.setEffect('pump', 'releaseMs', 200);
            rig.noteOn(0, rig.instrument(FM_SINE), 69);
            const before = measureRms(rig.render(200).left.subarray(RATE / 20));
            rig.noteOn(1, rig.instrument({ ...FM_SINE, volume: 0 }), 40);
            const after = rig.render(400).left;
            expect(measureRms(after.subarray(0, toFrames(10))) / before).toBeLessThan(0.4);
            expect(measureRms(after.subarray(toFrames(300), toFrames(400))) / before).toBeGreaterThan(0.9);
        });

        it('plays a sound on the highest free voice, at the pan the play gives', () => {
            const rig = createRig();
            const sound = rig.instrument({ ...FM_SINE, pan: -1 });
            rig.play(sound, { note: 69, lengthMs: 200, pan: 1 });
            const { left, right } = rig.render(100);
            const voice = findSounding(rig.synth);
            expect(voice).toBe(AUDIO90_VOICE_COUNT - 1);
            expect(rig.synth.findSoundOn(voice)).toBe(sound);
            expect(measureRms(left)).toBeLessThan(measureRms(right) / 100);
        });

        it('plays a sound at its own pan when the play gives none', () => {
            const rig = createRig();
            rig.play(rig.instrument({ ...FM_SINE, pan: 1 }), { note: 69, lengthMs: 200 });
            const { left, right } = rig.render(100);
            expect(measureRms(left)).toBeLessThan(measureRms(right) / 100);
        });

        it('holds a play with no length until it is stopped', () => {
            const rig = createRig();
            const sound = rig.instrument(FM_SINE);
            rig.play(sound, { note: 69, lengthMs: -1, id: 7 });
            rig.render(1000);
            expect(findSounding(rig.synth)).toBeGreaterThanOrEqual(0);
            rig.stop(7);
            rig.render(500);
            expect(findSounding(rig.synth)).toBe(-1);
        });

        it('rounds FM to nine bits in the console character', () => {
            const studio = createRig();
            studio.noteOn(0, studio.instrument(FM_SINE), 69);
            const clean = studio.render(100).left;
            const console = createRig();
            console.character('console');
            console.noteOn(0, console.instrument(FM_SINE), 69);
            const rounded = console.render(100).left;
            expect(rounded).not.toEqual(clean);
            expect(measureRms(rounded.subarray(toFrames(50)))).toBeCloseTo(measureRms(clean.subarray(toFrames(50))), 2);
        });
    });

    describe('as a whole', () => {
        it('renders the same samples from the same commands', () => {
            const make = (): Float32Array => {
                const rig = createRig();
                rig.noteOn(0, rig.instrument({ engine: ENGINE_ANALOG, wave: WAVE90_SAW, unison: 7, detune: 0.3, spread: 1, noise: 0.1, reverb: 0.5 }), 50);
                rig.noteOn(1, rig.instrument({ ...FM_TWO_OP, chorus: 0.5, echo: 0.5 }), 62);
                return rig.render(500).left;
            };
            expect(make()).toEqual(make());
        });

        it('fills every voice at once without a non-finite sample or clipping', () => {
            const rig = createRig();
            const ids = [
                rig.instrument({ ...FM_TWO_OP, reverb: 1, echo: 1, chorus: 1 }),
                rig.instrument({ engine: ENGINE_ANALOG, wave: WAVE90_SAW, unison: 7, detune: 0.3, spread: 1, filterMode: FILTER90_LOWPASS_24, cutoffHz: 2000, resonance: 0.9, reverb: 1 }),
            ];
            for (let v = 0; v < AUDIO90_VOICE_COUNT; v++) rig.noteOn(v, ids[v % 2], 40 + v * 3, 1);
            const { left, right } = rig.render(1000);
            let worst = 0;
            let notFinite = 0;
            for (let i = 0; i < left.length; i++) {
                if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) notFinite++;
                worst = Math.max(worst, Math.abs(left[i]), Math.abs(right[i]));
            }
            expect(notFinite).toBe(0);
            expect(worst).toBeLessThanOrEqual(1);
        });

        it('falls silent and forgets its sounds when it is reset', () => {
            const rig = createRig();
            const id = rig.instrument({ ...FM_SINE, reverb: 1 });
            rig.noteOn(0, id, 69);
            rig.render(100);
            rig.synth.reset();
            expect(measureRms(rig.render(100).left)).toBe(0);
            rig.noteOn(0, id, 69);
            expect(measureRms(rig.render(100).left)).toBe(0);
        });

        it('refuses a sample that does not fit in sample memory', () => {
            const synth = createAudio90Synthesiser({ sampleRate: RATE });
            const half = { data: new Int16Array(AUDIO90_SAMPLE_MEMORY / 2 + 1), sampleRate: RATE, rootNote: 60, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 };
            expect(synth.defineSample(1, half)).toBe(true);
            expect(synth.defineSample(2, half)).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RATE = 48000;
const BLOCK = 128;

const FM_SINE: Partial<Audio90SoundData> = {
    engine: ENGINE_FM,
    operators: [{ ratio: 1, fixedHz: 0, detuneCents: 0, level: 1, wave: OP_WAVE_SINE, velocity: 0, envelope: HELD_ENVELOPE }],
};

/** Operator 2 modulating operator 1, at the same ratio. */
const FM_TWO_OP: Partial<Audio90SoundData> = {
    engine: ENGINE_FM,
    algorithm: [0b10, 0, 0, 0],
    operators: [
        { ratio: 1, fixedHz: 0, detuneCents: 0, level: 1, wave: OP_WAVE_SINE, velocity: 0, envelope: HELD_ENVELOPE },
        { ratio: 1, fixedHz: 0, detuneCents: 0, level: 1, wave: OP_WAVE_SINE, velocity: 0, envelope: HELD_ENVELOPE },
    ],
};

interface Stereo {
    readonly left: Float32Array;
    readonly right: Float32Array;
}

/** A synthesiser, and a way to write it commands stamped in ms and render it a stretch at a time, as a worklet would. */
function createRig(options: Partial<Audio90SynthesiserOptions> = {}) {
    const synth: Audio90Synthesiser = createAudio90Synthesiser({ sampleRate: RATE, ...options });
    let nextId = 1;
    let nowMs = 0;
    const pending: number[] = [];
    const write = (op: number, atMs: number, a = 0, b = 0, c = 0, d = 0): void => {
        pending.push(op, atMs, a, b, c, d);
    };

    return {
        synth,
        instrument(overrides: Partial<Audio90SoundData>): number {
            const id = nextId++;
            synth.defineSound(id, { ...DEFAULT_AUDIO90_SOUND, ...overrides });
            return id;
        },
        sample(id: number, data: Audio90SampleData): void {
            expect(synth.defineSample(id, data)).toBe(true);
        },
        noteOn(voice: number, instrument: number, note: number, volume = 1, atMs = nowMs): void {
            write(OP_NOTE_ON, atMs, voice, instrument, note, volume);
        },
        noteOff(voice: number): void {
            write(OP_NOTE_OFF, nowMs, voice);
        },
        setVoice(voice: number, setting: Audio90VoiceSetting, value: number): void {
            write(OP_SET_VOICE, nowMs, voice, AUDIO90_VOICE_SETTING_INDEX[setting], value);
        },
        setEffect<E extends Audio90EffectId>(effect: E, setting: Audio90EffectSetting<E>, value: number): void {
            const settings: Readonly<Record<string, number>> = AUDIO90_EFFECT_SETTING_INDEX[effect];
            write(OP90_SET_EFFECT, nowMs, AUDIO90_EFFECT_INDEX[effect], settings[setting], value);
        },
        /** Plays sound `sound`, as a play's two commands do. A length of -1 holds it until it is stopped. */
        play(sound: number, play: { readonly note: number; readonly lengthMs: number; readonly pan?: number; readonly id?: number }): void {
            write(OP_PLAY_OPTIONS, -Infinity, play.lengthMs, -1, play.pan ?? 0, play.pan === undefined ? 0 : 1);
            write(OP_PLAY, -Infinity, sound, play.id ?? 1, play.note, 1);
        },
        stop(id: number): void {
            write(OP_STOP, -Infinity, id);
        },
        tempo(bpm: number): void {
            write(OP90_SET_TEMPO, nowMs, bpm);
        },
        character(character: Audio90Character): void {
            write(OP90_SET_CHARACTER, nowMs, AUDIO90_CHARACTERS.indexOf(character));
        },
        /** Renders the next `ms`, in blocks of 128 samples, playing the commands written. */
        render(ms: number): Stereo {
            const commands = Float64Array.from(pending);
            synth.enqueue(commands, commands.length / COMMAND_STRIDE);
            pending.length = 0;
            const frames = toFrames(ms);
            const left = new Float32Array(frames);
            const right = new Float32Array(frames);
            const msPerSample = 1000 / RATE;
            for (let at = 0; at < frames; at += BLOCK) {
                const count = Math.min(BLOCK, frames - at);
                synth.render(left, right, at, count, nowMs + at * msPerSample, msPerSample);
            }
            nowMs += ms;
            return { left, right };
        },
    };
}

function toFrames(ms: number): number {
    return Math.round(ms * RATE / 1000);
}

/** A sample of a sine at `hz`, `length` samples long, at its own rate. */
function sineSample(hz: number, sampleRate: number, rootNote: number, length = sampleRate): Audio90SampleData {
    const data = new Int16Array(length);
    for (let i = 0; i < length; i++) data[i] = Math.round(Math.sin(2 * Math.PI * hz * i / sampleRate) * 20000);
    return { data, sampleRate, rootNote, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 };
}

function findSounding(synth: Audio90Synthesiser): number {
    for (let v = 0; v < AUDIO90_VOICE_COUNT; v++) if (synth.isSounding(v)) return v;
    return -1;
}

/**
 * The pitch of a sound, in Hz, by autocorrelation: the shortest lag at which
 * it nearly matches itself is its period. A rich wave can cross zero several
 * times a cycle, so counting crossings would not do.
 */
function measurePitch(x: Float32Array): number {
    const window = x.subarray(0, Math.min(x.length, 4800));
    const shortest = Math.round(RATE / 2000);
    const longest = Math.round(RATE / 40);
    const scores = new Float64Array(longest + 1);
    let best = 0;
    for (let lag = shortest; lag <= longest; lag++) {
        let ab = 0;
        let aa = 0;
        let bb = 0;
        for (let i = 0; i + lag < window.length; i++) {
            ab += window[i] * window[i + lag];
            aa += window[i] * window[i];
            bb += window[i + lag] * window[i + lag];
        }
        scores[lag] = ab / Math.sqrt(aa * bb || 1);
        if (scores[lag] > best) best = scores[lag];
    }
    for (let lag = shortest + 1; lag < longest; lag++) {
        const s = scores[lag];
        if (s >= best * 0.9 && s >= scores[lag - 1] && s >= scores[lag + 1]) return RATE / lag;
    }
    return 0;
}

/** How strong the tone at `hz` is in a sound, by the Goertzel algorithm: its amplitude. */
function measureTone(x: Float32Array, hz: number): number {
    const k = 2 * Math.cos(2 * Math.PI * hz / RATE);
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < x.length; i++) {
        const s0 = x[i] + k * s1 - s2;
        s2 = s1;
        s1 = s0;
    }
    return Math.sqrt(s1 * s1 + s2 * s2 - k * s1 * s2) * 2 / x.length;
}

function measureRms(x: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < x.length; i++) sum += x[i] * x[i];
    return Math.sqrt(sum / Math.max(1, x.length));
}

function correlate(a: Float32Array, b: Float32Array): number {
    let ab = 0;
    let aa = 0;
    let bb = 0;
    for (let i = 0; i < a.length; i++) {
        ab += a[i] * b[i];
        aa += a[i] * a[i];
        bb += b[i] * b[i];
    }
    return ab / Math.sqrt(aa * bb);
}

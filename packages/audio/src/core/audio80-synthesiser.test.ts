import { describe, expect, it } from 'vitest';
import { createCommandAudio80 } from '../chip';
import { createInstrument, createSoundEffect, type InstrumentOptions } from '../notation';
import { createHeadlessAudio80, type HeadlessAudio80, hashSamples, measurePeak } from '../headless';
import { type Audio80Synthesiser, createAudio80Synthesiser } from './audio80-synthesiser';
import {
    ECHO_SETTING_INDEX,
    FILTER_SETTING_INDEX,
    OP_NOTE_ON,
    OP_PLAY_EFFECT,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_MIX,
    OP_SET_VOICE,
    VOICE_COUNT,
    VOICE_SETTING_INDEX,
} from './commands';
import type { Character } from './instrument-data';
import { toFrequency } from './notes';

const SAMPLE_RATE = 48000;
const A4 = 69;

describe('Audio80 synthesiser: pitch', () => {
    for (const wave of ['triangle', 'saw', 'pulse'] as const) {
        for (const note of [45, A4, 81]) {
            it(`plays a ${wave} at note ${note} within a cent of its frequency`, () => {
                const samples = renderNote({ wave }, note, 1000);
                const measured = measureFrequency(samples, 200);
                expect(measureCents(measured, toFrequency(note))).toBeLessThan(1);
            });
        }
    }
});

describe('Audio80 synthesiser: pulse width', () => {
    // The DC blocker centres each wave, so a sample's sign still says high or low
    for (const width of [0.125, 0.25, 0.5, 0.75]) {
        it(`holds a band-limited lone pulse of width ${width} high for that share of each cycle`, () => {
            const samples = renderNote({ wave: 'pulse', pulseWidth: width }, A4 - 24, 1000);
            expect(measureShareAbove(samples, 0)).toBeCloseTo(width, 1);
        });

        it(`holds a raw lone pulse of width ${width} high from that point in each cycle to its end, as combined waves do`, () => {
            const samples = renderNote({ wave: 'pulse', pulseWidth: width }, A4 - 24, 1000, { character: 'raw' });
            expect(measureShareAbove(samples, 0)).toBeCloseTo(1 - width, 1);
        });

        it(`lets the saw through a saw+pulse of width ${width} from that point in each cycle to its end`, () => {
            const samples = renderNote({ wave: 'saw+pulse', pulseWidth: width }, A4 - 24, 1000);
            // Where the saw is let through, the wave climbs at the saw's rate. Elsewhere it holds still
            const rises = new Float32Array(samples.length - 1);
            for (let i = 1; i < samples.length; i++) rises[i - 1] = samples[i] - samples[i - 1];
            // Rises above the 95th percentile come only from where the saw is let through
            const sorted = rises.slice(toFrames(300)).sort();
            const sawRate = sorted[Math.floor(0.95 * sorted.length)];
            expect(measureShareAbove(rises, sawRate / 2)).toBeCloseTo(1 - width, 1);
        });
    }

    /** The share of samples after the first 300 ms above `level`. */
    function measureShareAbove(samples: Float32Array, level: number): number {
        const from = toFrames(300);
        let above = 0;
        for (let i = from; i < samples.length; i++) if (samples[i] > level) above++;
        return above / (samples.length - from);
    }
});

describe('Audio80 synthesiser: envelopes', () => {
    it('rises through its attack in a straight line', () => {
        const attackMs = 100;
        const samples = renderNote({ wave: 'triangle', envelope: { attackMs, decayMs: 0, sustain: 1, releaseMs: 50 } }, A4, 400);
        const full = measureRmsBetween(samples, 200, 300);
        for (const share of [0.25, 0.5, 0.75]) {
            const at = attackMs * share;
            expect(measureRmsBetween(samples, at - 5, at + 5) / full).toBeCloseTo(share, 1);
        }
    });

    it('decays to its sustain level', () => {
        const envelope = { attackMs: 0, decayMs: 100, sustain: 0.5, releaseMs: 50 };
        const decayed = measureRmsBetween(renderNote({ wave: 'triangle', envelope }, A4, 600), 400, 500);
        const held = measureRmsBetween(renderNote({ wave: 'triangle', envelope: { ...envelope, sustain: 1 } }, A4, 600), 400, 500);
        expect(decayed / held).toBeCloseTo(envelope.sustain, 1);
    });

    it('falls silent over its release', () => {
        const envelope = { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 100 };
        const samples = renderNote({ wave: 'triangle', envelope }, A4, 500, { offMs: 200 });
        const held = measureRmsBetween(samples, 100, 200);
        expect(measureRmsBetween(samples, 205, 225) / held).toBeGreaterThan(0.2);
        expect(measureRmsBetween(samples, 310, 330) / held).toBeLessThan(0.002);
    });

    it('releases from where it is when a note ends during its attack', () => {
        // A square wave's level is the same throughout its cycle, so a few ms of it measure the envelope
        const envelope = { attackMs: 200, decayMs: 0, sustain: 1, releaseMs: 1000 };
        const offMs = 50;
        const released = renderNote({ wave: 'pulse', envelope }, A4, 400, { offMs });
        const held = renderNote({ wave: 'pulse', envelope }, A4, 400);
        expect(measurePeak(released) / measurePeak(held)).toBeLessThan(0.35);
        expect(measureRmsBetween(released, offMs, offMs + 5) / measureRmsBetween(released, offMs - 5, offMs)).toBeCloseTo(1, 1);
    });
});

describe('Audio80 synthesiser: sync and ring', () => {
    it('restarts a synced voice each time its source wraps, so it repeats at the source\'s period', () => {
        const chip = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE, character: 'clean' } });
        const source = createInstrument({ wave: 'triangle' });
        const synced = createInstrument({ wave: 'saw', syncSource: 0 });
        // At 100 Hz, the period is exactly 480 samples
        const sourceNote = A4 + 12 * Math.log2(100 / 440);
        chip.audio80.noteOn(0, source, sourceNote, 0);
        chip.audio80.noteOn(1, synced, sourceNote + 17.3, 1);
        const samples = render(chip, 500);
        const period = SAMPLE_RATE / 100;
        expect(measureCorrelation(samples, toFrames(200), toFrames(450), period)).toBeGreaterThan(0.95);
        // Without sync, the same notes do not repeat at that period
        const free = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE, character: 'clean' } });
        free.audio80.noteOn(0, source, sourceNote, 0);
        free.audio80.noteOn(1, createInstrument({ wave: 'saw' }), sourceNote + 17.3, 1);
        expect(measureCorrelation(render(free, 500), toFrames(200), toFrames(450), period)).toBeLessThan(0.9);
    });

    it('changes a triangle by ring modulation with its source, and stays in range', () => {
        const plain = renderNote({ wave: 'triangle' }, A4, 300);
        const chip = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE, character: 'clean' } });
        chip.audio80.noteOn(0, createInstrument({ wave: 'triangle' }), A4 - 7, 0);
        chip.audio80.noteOn(1, createInstrument({ wave: 'triangle', ringSource: 0 }), A4, 1);
        const ringed = render(chip, 300);
        expect(hashSamples(ringed)).not.toBe(hashSamples(plain));
        expect(measurePeak(ringed)).toBeLessThanOrEqual(1);
    });
});

describe('Audio80 synthesiser: noise', () => {
    it('renders the same noise on every run', () => {
        const a = renderNote({ wave: 'noise' }, A4, 200);
        const b = renderNote({ wave: 'noise' }, A4, 200);
        expect(hashSamples(a)).toBe(hashSamples(b));
    });

    it('changes faster at a higher pitch', () => {
        const low = countZeroCrossings(renderNote({ wave: 'noise' }, A4 - 36, 300));
        const high = countZeroCrossings(renderNote({ wave: 'noise' }, A4 + 12, 300));
        expect(high).toBeGreaterThan(low * 4);
    });
});

describe('Audio80 synthesiser: filters', () => {
    it('passes a note well below its cutoff, and cuts one far above it', () => {
        const dry = measureRmsBetween(renderNote({ wave: 'triangle' }, 55, 400), 200, 400);
        const passed = measureRmsBetween(renderFiltered(55, 3000, 0), 200, 400);
        const cut = measureRmsBetween(renderFiltered(55, 25, 0), 200, 400);
        expect(passed / dry).toBeGreaterThan(0.85);
        expect(cut / dry).toBeLessThan(0.15);
    });

    it('rings at its cutoff when resonant', () => {
        const note = 69;
        const flat = measureRmsBetween(renderFiltered(note, toFrequency(note), 0), 200, 400);
        const resonant = measureRmsBetween(renderFiltered(note, toFrequency(note), 0.9), 200, 400);
        expect(resonant).toBeGreaterThan(flat * 2);
    });

    it('does not let a silent voice\'s step table move a filter another voice is playing through', () => {
        const chip = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE, character: 'clean' } });
        // Opens filter a, holds it open for a second, then closes it, long after the note has died away
        const stepMs = 10;
        const openSteps = 100;
        const steps = 'fF\n'.repeat(openSteps) + 'f0';
        const closesLate = createInstrument({ wave: 'triangle', filter: 'a', stepMs, steps });
        chip.audio80.noteOn(0, closesLate, 60, 1, 0);
        chip.audio80.noteOff(0, 50);
        chip.audio80.noteOn(1, createInstrument({ wave: 'saw', filter: 'a' }), 60, 1, 0);
        const closedAtMs = openSteps * stepMs;
        const samples = render(chip, closedAtMs + 500);
        const before = measureRmsBetween(samples, closedAtMs - 400, closedAtMs);
        const after = measureRmsBetween(samples, closedAtMs + 100, closedAtMs + 500);
        expect(after / before).toBeGreaterThan(0.9);
    });

    it('treats a filter sweep from 0 Hz as no sweep', () => {
        // Built by hand, to get past `createInstrument`'s checks
        const saw = createInstrument({ wave: 'saw', filter: 'a' }).data;
        const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
        synthesiser.defineInstrument(1, { ...saw, filterSweepMs: 200, filterSweepFromHz: 0, filterSweepToHz: 2000 });
        synthesiser.enqueue(new Float64Array([OP_NOTE_ON, 0, 0, 1, 60, 1]), 1);
        const samples = renderSynthesiser(synthesiser, 300);
        expect(samples.every(Number.isFinite)).toBe(true);
        expect(measurePeak(samples)).toBeGreaterThan(0.01);
    });
});

describe('Audio80 synthesiser: safety', () => {
    it('stays in range, with no NaN, with every voice at full volume', () => {
        const chip = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE, character: 'raw' } });
        const loud = createInstrument({ wave: 'saw', echo: 1 });
        for (let v = 0; v < VOICE_COUNT; v++) chip.audio80.noteOn(v, loud, 40 + v, 1);
        const samples = render(chip, 500);
        for (let i = 0; i < samples.length; i++) {
            expect(Number.isFinite(samples[i])).toBe(true);
            expect(Math.abs(samples[i])).toBeLessThanOrEqual(1);
        }
    });

    it('is exactly silent with nothing playing', () => {
        expect(measurePeak(render(createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE } }), 100))).toBe(0);
    });

    it('renders the same samples for the same commands, however they are split into blocks', () => {
        const whole = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE } });
        const split = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE } });
        const lead = createInstrument({ wave: 'pulse', pulseSweep: { to: 0.9, ms: 200, isPingPong: true }, vibrato: { semitones: 0.3, hz: 6 } });
        for (const chip of [whole, split]) {
            chip.audio80.noteOn(0, lead, 60, 1);
            chip.audio80.noteOn(1, lead, 64, 1, 50);
            chip.audio80.noteOff(0, 120);
            chip.controls.update(200);
        }
        const once = new Float32Array(toFrames(200));
        whole.render(once);
        const joined = new Float32Array(toFrames(200));
        split.render(joined.subarray(0, 1000));
        split.render(joined.subarray(1000));
        expect(hashSamples(joined)).toBe(hashSamples(once));
    });
});

describe('Audio80 synthesiser: bad numbers', () => {
    // Each one is written while voice 0 plays, between two of its notes
    const writes: readonly (readonly [string, readonly number[]])[] = [
        ['volume', [OP_SET_VOICE, 0, VOICE_SETTING_INDEX.volume, Number.NaN, 0]],
        ['echo send', [OP_SET_VOICE, 0, VOICE_SETTING_INDEX.echoSend, Number.NaN, 0]],
        ['note', [OP_SET_VOICE, 0, VOICE_SETTING_INDEX.note, Number.NaN, 0]],
        ['cutoff', [OP_SET_FILTER, 0, FILTER_SETTING_INDEX.cutoffHz, Number.NaN, 0]],
        ['echo time', [OP_SET_ECHO, ECHO_SETTING_INDEX.timeMs, Number.NaN, 0, 0]],
        ['echo feedback', [OP_SET_ECHO, ECHO_SETTING_INDEX.feedback, Number.NaN, 0, 0]],
        ['mix gain', [OP_SET_MIX, 0, Number.NaN, 0, 0]],
    ];
    for (const [name, [op, ...operands]] of writes) {
        it(`ignores a NaN ${name}, and plays the next note`, () => {
            const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
            synthesiser.defineInstrument(1, createInstrument({ wave: 'saw', filter: 'a', echo: 1 }).data);
            synthesiser.enqueue(new Float64Array([
                OP_NOTE_ON, 0, 0, 1, 60, 1,
                op, 50, ...operands,
                OP_NOTE_ON, 100, 0, 1, 64, 1,
            ]), 3);
            const samples = renderSynthesiser(synthesiser, 300);
            expect(samples.every(Number.isFinite)).toBe(true);
            expect(measureRmsBetween(samples, 200, 300)).toBeGreaterThan(0.01);
        });
    }

    it('ignores a command stamped NaN or +Infinity, and applies the ones after it', () => {
        const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
        synthesiser.defineInstrument(1, createInstrument({ wave: 'saw' }).data);
        synthesiser.enqueue(new Float64Array([
            OP_NOTE_ON, Number.NaN, 0, 1, 60, 1,
            OP_NOTE_ON, Infinity, 1, 1, 60, 1,
            OP_NOTE_ON, 10, 2, 1, 64, 1,
        ]), 3);
        renderSynthesiser(synthesiser, 100);
        expect(synthesiser.isSounding(0)).toBe(false);
        expect(synthesiser.isSounding(1)).toBe(false);
        expect(synthesiser.isSounding(2)).toBe(true);
    });

    it('ignores a NaN gain set directly', () => {
        const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
        synthesiser.setMix(0, Number.NaN);
        synthesiser.defineInstrument(1, createInstrument({ wave: 'saw' }).data);
        synthesiser.enqueue(new Float64Array([OP_NOTE_ON, 0, 0, 1, 60, 1]), 1);
        const samples = renderSynthesiser(synthesiser, 100);
        expect(samples.every(Number.isFinite)).toBe(true);
        expect(measurePeak(samples)).toBeGreaterThan(0.01);
    });
});

describe('Audio80 synthesiser: stamps', () => {
    for (const stampMs of [10, 10.01]) {
        it(`starts a note stamped ${stampMs} ms on the first sample at or after that time`, () => {
            const chip = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE, character: 'clean' } });
            chip.audio80.noteOn(0, createInstrument({ wave: 'pulse', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 } }), A4, 1, stampMs);
            const samples = render(chip, 20);
            const start = Math.ceil(stampMs * SAMPLE_RATE / 1000);
            expect(measurePeak(samples.subarray(0, start))).toBe(0);
            expect(Math.abs(samples[start])).toBeGreaterThan(0);
        });
    }
});

describe('Audio80 synthesiser: the mix', () => {
    it('gives the music\'s voices and the effects\' voices separate gains', () => {
        const musicOnly = measureMix({ music: 1, effects: 0 });
        const effectsOnly = measureMix({ music: 0, effects: 1 });
        const both = measureMix({ music: 1, effects: 1 });
        expect(musicOnly).toBeGreaterThan(0.01);
        expect(effectsOnly).toBeGreaterThan(0.01);
        expect(both).toBeGreaterThan(Math.max(musicOnly, effectsOnly));
        expect(measureMix({ music: 0, effects: 0 })).toBeLessThan(1e-4);
    });

    it('ramps to a new gain rather than jumping, so a moving slider does not click', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        writer.noteOn(0, createInstrument({ wave: 'triangle' }), 57, 1);
        step();
        writer.setMix('music', 0);
        const samples = new Float32Array(16);
        synthesiser.enqueue(writer.commands, writer.count);
        writer.clear(writer.commands);
        synthesiser.render(samples, 0, samples.length, 1000, 1000 / SAMPLE_RATE);
        // Sixteen samples after the change, the gain has barely fallen
        expect(measurePeak(samples)).toBeGreaterThan(0.05);
    });

    it('keeps the mix gains through a reset', () => {
        const { synthesiser, writer, step, samples } = createSynthesiserWithWriter();
        writer.setMix('music', 0);
        step();
        synthesiser.reset();
        writer.forget();
        writer.noteOn(0, createInstrument({ wave: 'triangle' }), 57, 1);
        for (let i = 0; i < 5; i++) step();
        expect(synthesiser.isSounding(0)).toBe(true);
        expect(measurePeak(samples)).toBeLessThan(1e-4);
    });

    function measureMix(gains: { music: number; effects: number }): number {
        const { synthesiser, writer, step, samples } = createSynthesiserWithWriter();
        synthesiser.setMix(0, gains.music);
        synthesiser.setMix(1, gains.effects);
        writer.noteOn(0, createInstrument({ wave: 'triangle' }), 57, 1);
        writer.play(BEEP);
        step();
        step();
        return measureRms(samples);
    }
});

describe('Audio80 synthesiser: effect voices', () => {
    it('gives an effect the highest free voice, so music starting in the same tick does not cut it', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        const tune = createInstrument({ wave: 'pulse' });
        // As when a ship returns: its effect plays, and the music starts again on voices 0 to 3
        writer.play(BOOM);
        writer.reserveVoices(4);
        for (let v = 0; v < 4; v++) writer.noteOn(v, tune, 60 + v, 1);
        step();
        const playing = listEffectsOn(synthesiser);
        expect(playing[VOICE_COUNT - 1]).toBeDefined();
        expect(playing.slice(0, 4).every((id) => id === undefined)).toBe(true);
    });

    it('never plays an effect on a voice kept for music', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        const musicVoices = VOICE_COUNT - 2;
        // Reserve the voices a tick early. Effects skip ahead of stamped writes in the same tick
        writer.reserveVoices(musicVoices);
        step();
        writer.play(ZAP);
        step();
        const zap = listEffectsOn(synthesiser).find((id) => id !== undefined);
        writer.play(BOOM);
        step();
        const boom = listEffectsOn(synthesiser).find((id) => id !== undefined && id !== zap);
        expect(boom).toBeDefined();
        const boomVoice = listEffectsOn(synthesiser).indexOf(boom);
        // Both free voices are taken. So BEEP takes the oldest voice whose effect has no higher
        // priority, which is ZAP's, not BOOM's
        writer.play(BEEP);
        step();
        const playing = listEffectsOn(synthesiser);
        expect(playing.slice(0, musicVoices).every((id) => id === undefined)).toBe(true);
        expect(boomVoice).toBeGreaterThanOrEqual(musicVoices);
        expect(playing[boomVoice]).toBe(boom);
        expect(playing).not.toContain(zap);
        expect(playing.filter((id) => id !== undefined)).toHaveLength(2);
    });

    it('restarts an effect\'s oldest voice when it already plays on its maximum, rather than taking another', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        for (let i = 0; i <= ZAP.data.maxVoices; i++) {
            writer.play(ZAP);
            step();
        }
        expect(listEffectsOn(synthesiser).filter((id) => id !== undefined)).toHaveLength(ZAP.data.maxVoices);
    });

    it('never takes a voice from an effect of higher priority', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        writer.reserveVoices(VOICE_COUNT - 1);
        step();
        writer.play(BOOM);
        step();
        const boom = listEffectsOn(synthesiser)[VOICE_COUNT - 1];
        writer.play(ZAP);
        step();
        expect(listEffectsOn(synthesiser)[VOICE_COUNT - 1]).toBe(boom);
    });

    it('frees a voice once its effect has died away', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        writer.play(ZAP);
        step();
        expect(listEffectsOn(synthesiser).some((id) => id !== undefined)).toBe(true);
        // Wait out its length, then its release, and a tick to spare
        const ticks = Math.ceil((ZAP.data.lengthMs + ZAP.data.instrument.releaseMs) / TICK_MS) + 1;
        for (let i = 0; i < ticks; i++) step();
        expect(listEffectsOn(synthesiser).every((id) => id === undefined)).toBe(true);
    });

    it('releases an effect with a length of 0', () => {
        const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
        synthesiser.defineEffect(1, { ...ZAP.data, lengthMs: 0 });
        synthesiser.enqueue(new Float64Array([OP_PLAY_EFFECT, -Infinity, 1, 0, 0, 0]), 1);
        renderSynthesiser(synthesiser, ZAP.data.instrument.releaseMs + TICK_MS);
        expect(listEffectsOn(synthesiser).every((id) => id === undefined)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZAP = createSoundEffect({ wave: 'pulse', note: 'C-6', lengthMs: 100, priority: 0 });
const BEEP = createSoundEffect({ wave: 'triangle', note: 'C-5', lengthMs: 100, priority: 0 });
const BOOM = createSoundEffect({ wave: 'noise', note: 'C-4', lengthMs: 300, priority: 2 });

/** How long each step of `createSynthesiserWithWriter` renders, like one tick of a game loop. */
const TICK_MS = 16;

/**
 * Creates a synthesiser and a command Audio80 that feeds it. `step` renders
 * one tick of what was written into `samples`.
 */
function createSynthesiserWithWriter() {
    const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
    const writer = createCommandAudio80({
        onInstrument: (id, data) => synthesiser.defineInstrument(id, data),
        onEffect: (id, data) => synthesiser.defineEffect(id, data),
    });
    const samples = new Float32Array(toFrames(TICK_MS));
    let fromMs = 0;
    const step = () => {
        writer.update(TICK_MS);
        synthesiser.enqueue(writer.commands, writer.count);
        writer.clear(writer.commands);
        synthesiser.render(samples, 0, samples.length, fromMs, 1000 / SAMPLE_RATE);
        fromMs += samples.length * 1000 / SAMPLE_RATE;
    };
    return { synthesiser, writer, step, samples };
}

/** Renders `ms` of a synthesiser from chip time 0, in one block. */
function renderSynthesiser(synthesiser: Audio80Synthesiser, ms: number): Float32Array {
    const samples = new Float32Array(toFrames(ms));
    synthesiser.render(samples, 0, samples.length, 0, 1000 / SAMPLE_RATE);
    return samples;
}

function measureRms(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / samples.length);
}

/** Lists the effect each voice is playing, by voice: its id, or `undefined` for a voice playing none. */
function listEffectsOn(synthesiser: Audio80Synthesiser): (number | undefined)[] {
    const ids: (number | undefined)[] = [];
    for (let v = 0; v < VOICE_COUNT; v++) ids.push(synthesiser.findEffectOn(v));
    return ids;
}

/**
 * Renders one note of an instrument, alone. The note is released at `offMs`
 * if it is given. The character is clean unless another is given.
 */
function renderNote(options: InstrumentOptions, note: number, ms: number, extra: { offMs?: number; character?: Character } = {}): Float32Array {
    const chip = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE, character: extra.character ?? 'clean' } });
    chip.audio80.noteOn(0, createInstrument(options), note, 1);
    if (extra.offMs !== undefined) chip.audio80.noteOff(0, extra.offMs);
    return render(chip, ms);
}

function renderFiltered(note: number, cutoffHz: number, resonance: number): Float32Array {
    const chip = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE, character: 'clean' } });
    chip.audio80.setFilter('a', 'mode', 'lowpass');
    chip.audio80.setFilter('a', 'cutoffHz', cutoffHz);
    chip.audio80.setFilter('a', 'resonance', resonance);
    chip.audio80.noteOn(0, createInstrument({ wave: 'triangle', filter: 'a' }), note, 1);
    return render(chip, 400);
}

function render(chip: HeadlessAudio80<{ render: true }>, ms: number): Float32Array {
    chip.controls.update(ms);
    const samples = new Float32Array(toFrames(ms));
    chip.render(samples);
    return samples;
}

function toFrames(ms: number): number {
    return Math.round(ms * SAMPLE_RATE / 1000);
}

/**
 * The frequency of a periodic signal after `fromMs`. It is measured from the
 * times the signal crosses zero going up, interpolated between samples.
 */
function measureFrequency(samples: Float32Array, fromMs: number): number {
    let first = -1;
    let last = -1;
    let count = 0;
    for (let i = toFrames(fromMs) + 1; i < samples.length; i++) {
        if (samples[i - 1] < 0 && samples[i] >= 0) {
            const at = i - 1 + samples[i - 1] / (samples[i - 1] - samples[i]);
            if (first < 0) first = at;
            last = at;
            count++;
        }
    }
    return (count - 1) * SAMPLE_RATE / (last - first);
}

function measureCents(a: number, b: number): number {
    return Math.abs(1200 * Math.log2(a / b));
}

function measureRmsBetween(samples: Float32Array, fromMs: number, toMs: number): number {
    let sum = 0;
    const from = toFrames(fromMs);
    const to = toFrames(toMs);
    for (let i = from; i < to; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / (to - from));
}

function countZeroCrossings(samples: Float32Array): number {
    let count = 0;
    for (let i = 1; i < samples.length; i++) if ((samples[i - 1] < 0) !== (samples[i] < 0)) count++;
    return count;
}

/** How alike a signal is to itself `lag` samples later, -1 to 1, over `from` to `to`. */
function measureCorrelation(samples: Float32Array, from: number, to: number, lag: number): number {
    let ab = 0;
    let aa = 0;
    let bb = 0;
    for (let i = from; i < to; i++) {
        const a = samples[i];
        const b = samples[i + lag];
        ab += a * b;
        aa += a * a;
        bb += b * b;
    }
    return ab / Math.sqrt(aa * bb);
}

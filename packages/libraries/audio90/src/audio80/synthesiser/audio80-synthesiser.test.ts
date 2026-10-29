import { describe, expect, it } from 'vitest';
import { type Audio80PlayOptions, createAudio80SoundIds } from '../chip';
import { createAudio80Sound, type Audio80Sound, type Audio80SoundOptions } from '../notation';
import { hashSamples, measurePeak } from '../../headless';
import { type Audio80Synthesiser, createAudio80Synthesiser } from './audio80-synthesiser';
import {
    AUDIO80_ECHO_SETTING_INDEX,
    AUDIO80_FILTER_SETTING_INDEX,
    OP80_SET_ECHO,
    OP80_SET_FILTER,
    AUDIO80_VOICE_COUNT,
    AUDIO80_VOICE_SETTING_INDEX,
} from './commands';
import { type Audio80Character, FILTER80_LOWPASS } from './sound-data';
import {
    type CommandWriter, createCommandWriter, OP_NOTE_OFF, OP_NOTE_ON, OP_PLAY, OP_PLAY_OPTIONS, OP_SET_VOICE, SCOPE_POINTS, toFrequency, toScopeLength,
} from '../../shared';

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
        const chip = createVoiceRig('clean');
        const source = createAudio80Sound({ wave: 'triangle' });
        const synced = createAudio80Sound({ wave: 'saw', syncSource: 0 });
        // At 100 Hz, the period is exactly 480 samples
        const sourceNote = A4 + 12 * Math.log2(100 / 440);
        noteOn(chip.audio80, 0, source, sourceNote, 0);
        noteOn(chip.audio80, 1, synced, sourceNote + 17.3, 1);
        const samples = render(chip, 500);
        const period = SAMPLE_RATE / 100;
        expect(measureCorrelation(samples, toFrames(200), toFrames(450), period)).toBeGreaterThan(0.95);
        // Without sync, the same notes do not repeat at that period
        const free = createVoiceRig('clean');
        noteOn(free.audio80, 0, source, sourceNote, 0);
        noteOn(free.audio80, 1, createAudio80Sound({ wave: 'saw' }), sourceNote + 17.3, 1);
        expect(measureCorrelation(render(free, 500), toFrames(200), toFrames(450), period)).toBeLessThan(0.9);
    });

    it('changes a triangle by ring modulation with its source, and stays in range', () => {
        const plain = renderNote({ wave: 'triangle' }, A4, 300);
        const chip = createVoiceRig('clean');
        noteOn(chip.audio80, 0, createAudio80Sound({ wave: 'triangle' }), A4 - 7, 0);
        noteOn(chip.audio80, 1, createAudio80Sound({ wave: 'triangle', ringSource: 0 }), A4, 1);
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
        const chip = createVoiceRig('clean');
        // Opens filter a, holds it open for a second, then closes it, long after the note has died away
        const stepMs = 10;
        const openSteps = 100;
        const steps = 'fF\n'.repeat(openSteps) + 'f0';
        const closesLate = createAudio80Sound({ wave: 'triangle', filter: 'a', stepMs, steps });
        noteOn(chip.audio80, 0, closesLate, 60, 1, 0);
        noteOff(chip.audio80, 0, 50);
        noteOn(chip.audio80, 1, createAudio80Sound({ wave: 'saw', filter: 'a' }), 60, 1, 0);
        const closedAtMs = openSteps * stepMs;
        const samples = render(chip, closedAtMs + 500);
        const before = measureRmsBetween(samples, closedAtMs - 400, closedAtMs);
        const after = measureRmsBetween(samples, closedAtMs + 100, closedAtMs + 500);
        expect(after / before).toBeGreaterThan(0.9);
    });

    it('treats a filter sweep from 0 Hz as no sweep', () => {
        // Built by hand, to get past `createAudio80Sound`'s checks
        const saw = createAudio80Sound({ wave: 'saw', filter: 'a' }).data;
        const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
        synthesiser.defineSound(1, { ...saw, filterSweepMs: 200, filterSweepFromHz: 0, filterSweepToHz: 2000 });
        synthesiser.enqueue(new Float64Array([OP_NOTE_ON, 0, 0, 1, 60, 1]), 1);
        const samples = renderSynthesiser(synthesiser, 300);
        expect(samples.every(Number.isFinite)).toBe(true);
        expect(measurePeak(samples)).toBeGreaterThan(0.01);
    });
});

describe('Audio80 synthesiser: safety', () => {
    it('stays in range, with no NaN, with every voice at full volume', () => {
        const chip = createVoiceRig('raw');
        const loud = createAudio80Sound({ wave: 'saw', echo: 1 });
        for (let v = 0; v < AUDIO80_VOICE_COUNT; v++) noteOn(chip.audio80, v, loud, 40 + v, 1);
        const samples = render(chip, 500);
        for (let i = 0; i < samples.length; i++) {
            expect(Number.isFinite(samples[i])).toBe(true);
            expect(Math.abs(samples[i])).toBeLessThanOrEqual(1);
        }
    });

    it('is exactly silent with nothing playing', () => {
        expect(measurePeak(render(createVoiceRig(), 100))).toBe(0);
    });

    it('renders the same samples for the same commands, however they are split into blocks', () => {
        const whole = createVoiceRig();
        const split = createVoiceRig();
        const lead = createAudio80Sound({ wave: 'pulse', pulseSweep: { to: 0.9, ms: 200, isPingPong: true }, vibrato: { semitones: 0.3, hz: 6 } });
        for (const chip of [whole, split]) {
            noteOn(chip.audio80, 0, lead, 60, 1);
            noteOn(chip.audio80, 1, lead, 64, 1, 50);
            noteOff(chip.audio80, 0, 120);
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
        ['volume', [OP_SET_VOICE, 0, AUDIO80_VOICE_SETTING_INDEX.volume, Number.NaN, 0]],
        ['cutoff', [OP80_SET_FILTER, 0, AUDIO80_FILTER_SETTING_INDEX.cutoffHz, Number.NaN, 0]],
        ['echo time', [OP80_SET_ECHO, AUDIO80_ECHO_SETTING_INDEX.timeMs, Number.NaN, 0, 0]],
        ['echo feedback', [OP80_SET_ECHO, AUDIO80_ECHO_SETTING_INDEX.feedback, Number.NaN, 0, 0]],
    ];
    for (const [name, [op, ...operands]] of writes) {
        it(`ignores a NaN ${name}, and plays the next note`, () => {
            const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
            synthesiser.defineSound(1, createAudio80Sound({ wave: 'saw', filter: 'a', echo: 1 }).data);
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
});

describe('Audio80 synthesiser: played sounds', () => {
    it('gives a played sound the highest free voice, away from the voices a song on the same chip takes first', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        const tune = createAudio80Sound({ wave: 'pulse' });
        // As when a ship returns: its sound plays, and the music starts again from voice 0
        writer.play(BOOM);
        for (let v = 0; v < AUDIO80_VOICE_COUNT - 1; v++) noteOn(writer, v, tune, 60 + v, 1);
        step();
        const playing = listSoundsOn(synthesiser);
        expect(playing[AUDIO80_VOICE_COUNT - 1]).toBeDefined();
        expect(playing.slice(0, AUDIO80_VOICE_COUNT - 1).every((id) => id === undefined)).toBe(true);
    });

    it('with no voice free, takes the oldest voice whose sound has no higher priority', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        // Every voice but two is held by a sound of the highest priority
        const held = createAudio80Sound({ wave: 'pulse', note: 'C-3', priority: 3, maxVoices: AUDIO80_VOICE_COUNT });
        for (let v = 0; v < AUDIO80_VOICE_COUNT - 2; v++) writer.play(held, { lengthMs: Infinity });
        step();
        writer.play(ZAP);
        step();
        writer.play(BOOM);
        step();
        // Both free voices are taken. So BEEP takes the oldest voice whose sound has no higher
        // priority, which is ZAP's, not BOOM's or the held sound's
        writer.play(BEEP);
        step();
        const playing = listSoundsOn(synthesiser);
        expect(playing).toContain(writer.soundId(BOOM));
        expect(playing).toContain(writer.soundId(BEEP));
        expect(playing).not.toContain(writer.soundId(ZAP));
        expect(playing.filter((id) => id !== undefined)).toHaveLength(AUDIO80_VOICE_COUNT);
    });

    it('frees a voice once its sound has died away', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        writer.play(ZAP);
        step();
        expect(listSoundsOn(synthesiser).some((id) => id !== undefined)).toBe(true);
        // Wait out its length, then its release, and a tick to spare
        const ticks = Math.ceil((ZAP.data.lengthMs + ZAP.data.releaseMs) / TICK_MS) + 1;
        for (let i = 0; i < ticks; i++) step();
        expect(listSoundsOn(synthesiser).every((id) => id === undefined)).toBe(true);
    });

    it('releases a play with a length of 0', () => {
        const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
        synthesiser.defineSound(1, ZAP.data);
        synthesiser.enqueue(new Float64Array([OP_PLAY_OPTIONS, -Infinity, 0, -1, 0, 0, OP_PLAY, -Infinity, 1, 1, ZAP.data.note, 1]), 2);
        renderSynthesiser(synthesiser, ZAP.data.releaseMs + TICK_MS);
        expect(listSoundsOn(synthesiser).every((id) => id === undefined)).toBe(true);
    });

    it('holds a play with a length of Infinity until it is stopped, then releases it', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        const id = writer.play(ZAP, { lengthMs: Infinity });
        const ticks = Math.ceil((ZAP.data.lengthMs + ZAP.data.releaseMs) / TICK_MS) + 1;
        for (let i = 0; i < ticks; i++) step();
        expect(listSoundsOn(synthesiser).filter((sound) => sound !== undefined)).toHaveLength(1);
        writer.stop(id);
        for (let i = 0; i < Math.ceil(ZAP.data.releaseMs / TICK_MS) + 1; i++) step();
        expect(listSoundsOn(synthesiser).every((sound) => sound === undefined)).toBe(true);
    });

    it('stops only the play it is given, and not a later play on the same voice', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        const first = writer.play(ZAP, { lengthMs: Infinity });
        step();
        // ZAP plays on one voice at most, so playing it again restarts that voice as a new play
        writer.play(ZAP, { lengthMs: Infinity });
        step();
        writer.stop(first);
        for (let i = 0; i < Math.ceil(ZAP.data.releaseMs / TICK_MS) + 1; i++) step();
        expect(listSoundsOn(synthesiser)[AUDIO80_VOICE_COUNT - 1]).toBeDefined();
    });

    it('plays at the note and glide a play gives in place of the sound\'s own', () => {
        const options: Audio80SoundOptions = { wave: 'pulse', note: 'C-6', lengthMs: 200 };
        const plain = createAudio80Sound(options);
        expect(renderPlay(plain, { note: 'C-4' })).toBe(renderPlay(createAudio80Sound({ ...options, note: 'C-4' })));
        expect(renderPlay(plain, { glideTo: 'C-4' })).toBe(renderPlay(createAudio80Sound({ ...options, glideTo: 'C-4' })));
        expect(renderPlay(plain, { note: 'C-4' })).not.toBe(renderPlay(plain));

        /** The hash of one tick of `sound`, played on its own with `playOptions`. */
        function renderPlay(sound: Audio80Sound, playOptions?: Audio80PlayOptions): string {
            const { writer, step, samples } = createSynthesiserWithWriter();
            writer.play(sound, playOptions);
            step();
            return hashSamples(samples);
        }
    });

    it('numbers its plays from 1', () => {
        const { writer } = createSynthesiserWithWriter();
        expect([writer.play(ZAP), writer.play(BEEP), writer.play(ZAP)]).toEqual([1, 2, 3]);
    });
});

describe('Audio80 synthesiser: scope', () => {
    it('writes every voice\'s points into its scope, with the voice playing at about full scale and the rest silent', () => {
        const { synthesiser, writer, step } = createSynthesiserWithWriter();
        const scope = new Float32Array(toScopeLength(AUDIO80_VOICE_COUNT)).fill(NaN);
        synthesiser.scope = scope;
        writer.play(HELD_SAW, { note: 'A-3', lengthMs: Infinity });
        step();
        const peaks: number[] = [];
        for (let v = 0; v < AUDIO80_VOICE_COUNT; v++) peaks.push(measurePeak(scope.subarray(v * SCOPE_POINTS, (v + 1) * SCOPE_POINTS)));
        // A point left unwritten would still be NaN, and fail both
        expect(peaks.filter((peak) => peak > 0.5)).toHaveLength(1);
        expect(peaks.filter((peak) => peak === 0)).toHaveLength(AUDIO80_VOICE_COUNT - 1);
    });

    it('renders the same samples with a scope as without', () => {
        const renderHeld = (hasScope: boolean): string => {
            const { synthesiser, writer, step, samples } = createSynthesiserWithWriter();
            if (hasScope) synthesiser.scope = new Float32Array(toScopeLength(AUDIO80_VOICE_COUNT));
            writer.play(HELD_SAW, { note: 'A-3', lengthMs: Infinity });
            step();
            return hashSamples(samples);
        };
        expect(renderHeld(true)).toBe(renderHeld(false));
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZAP = createAudio80Sound({ wave: 'pulse', note: 'C-6', lengthMs: 100, priority: 0 });
const BEEP = createAudio80Sound({ wave: 'triangle', note: 'C-5', lengthMs: 100, priority: 0 });
const BOOM = createAudio80Sound({ wave: 'noise', note: 'C-4', lengthMs: 300, priority: 2 });
/** A saw at full level from its first sample. */
const HELD_SAW = createAudio80Sound({ wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } });

/** How long each step of `createSynthesiserWithWriter` renders, like one tick of a game loop. */
const TICK_MS = 16;

/**
 * Creates a synthesiser and a command writer that feeds it. `step` renders
 * one tick of what was written into `samples`.
 */
function createSynthesiserWithWriter() {
    const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE });
    const writer = createAudio80Writer(synthesiser);
    const samples = new Float32Array(toFrames(TICK_MS));
    let fromMs = 0;
    const step = () => {
        writer.update(TICK_MS);
        synthesiser.enqueue(writer.commands, writer.count);
        writer.clear();
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

/** Lists the sound each voice was played with, by voice: its id, or `undefined` for a voice playing none. */
function listSoundsOn(synthesiser: Audio80Synthesiser): (number | undefined)[] {
    const ids: (number | undefined)[] = [];
    for (let v = 0; v < AUDIO80_VOICE_COUNT; v++) ids.push(synthesiser.findSoundOn(v));
    return ids;
}

/**
 * Renders one note of a sound, alone, on voice 0. The note is released at `offMs`
 * if it is given. The character is clean unless another is given.
 */
function renderNote(options: Audio80SoundOptions, note: number, ms: number, extra: { offMs?: number; character?: Audio80Character } = {}): Float32Array {
    const chip = createVoiceRig(extra.character ?? 'clean');
    noteOn(chip.audio80, 0, createAudio80Sound(options), note, 1);
    if (extra.offMs !== undefined) noteOff(chip.audio80, 0, extra.offMs);
    return render(chip, ms);
}

function renderFiltered(note: number, cutoffHz: number, resonance: number): Float32Array {
    const chip = createVoiceRig('clean');
    const writer = chip.audio80;
    writer.write(OP80_SET_FILTER, writer.time, 0, AUDIO80_FILTER_SETTING_INDEX.mode, FILTER80_LOWPASS, 0);
    writer.write(OP80_SET_FILTER, writer.time, 0, AUDIO80_FILTER_SETTING_INDEX.cutoffHz, cutoffHz, 0);
    writer.write(OP80_SET_FILTER, writer.time, 0, AUDIO80_FILTER_SETTING_INDEX.resonance, resonance, 0);
    noteOn(chip.audio80, 0, createAudio80Sound({ wave: 'triangle', filter: 'a' }), note, 1);
    return render(chip, 400);
}

/**
 * A synthesiser fed by a command writer, which plays each note on the voice it
 * is told to, as a song's notes are played. It renders as a headless chip does,
 * up to where `controls.update` has moved its clock.
 */
interface VoiceRig {
    readonly audio80: CommandWriter<Audio80Sound, Audio80PlayOptions>;
    readonly controls: { readonly update: (deltaMs: number) => void };
    readonly render: (output: Float32Array) => void;
}

function createVoiceRig(character?: Audio80Character): VoiceRig {
    const synthesiser = createAudio80Synthesiser({ sampleRate: SAMPLE_RATE, character });
    const writer = createAudio80Writer(synthesiser);
    let renderedFrames = 0;
    return {
        audio80: writer,
        controls: { update: writer.update },
        render(output) {
            synthesiser.enqueue(writer.commands, writer.count);
            writer.clear();
            synthesiser.render(output, 0, output.length, renderedFrames * 1000 / SAMPLE_RATE, 1000 / SAMPLE_RATE);
            renderedFrames += output.length;
        },
    };
}

function render(chip: VoiceRig, ms: number): Float32Array {
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

/** Starts `note` on `voice` with `sound`, at `atMs` or the writer's time, as a song's note does. */
function noteOn(writer: CommandWriter<Audio80Sound, Audio80PlayOptions>, voice: number, sound: Audio80Sound, note: number, volume: number, atMs = writer.time): void {
    writer.write(OP_NOTE_ON, atMs, voice, writer.soundId(sound), note, volume);
}

/** Releases `voice`'s note at `atMs` or the writer's time, as a song does. */
function noteOff(writer: CommandWriter<Audio80Sound, Audio80PlayOptions>, voice: number, atMs = writer.time): void {
    writer.write(OP_NOTE_OFF, atMs, voice, 0, 0, 0);
}

/** Creates a writer that defines its sounds for `synthesiser`. */
function createAudio80Writer(synthesiser: Audio80Synthesiser): CommandWriter<Audio80Sound, Audio80PlayOptions> {
    return createCommandWriter({ soundIds: createAudio80SoundIds({ onSound: (id, data) => synthesiser.defineSound(id, data) }) });
}

import { describe, expect, expectTypeOf, it } from 'vitest';
import { createCommandAudio80, MAX_MIX_VOLUME } from '../chip';
import {
    COMMAND_STRIDE,
    FILTER_HIGHPASS,
    FILTER_LOWPASS,
    FILTER_SETTING_INDEX,
    type FilterMode,
    OP_SET_FILTER,
    OP_SET_VOICE,
    VOICE_SETTING_INDEX,
    type Wave,
} from '../core';
import { createInstrument, createSoundEffect } from '../notation';
import { type ChipRenderer, type ChipWrite, createHeadlessAudio80, type HeadlessAudio80 } from './headless-audio80';
import { hashSamples, measurePeak } from './render';

const MUSIC_VOLUME = 0.5;
/** A tenth of a second at the default 48 kHz. */
const FRAMES = 4800;
const DEFAULT_SAMPLE_RATE = 48000;
const TICK_MS = 1000 / 60;
const INSTRUMENT = createInstrument({ wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } });
const EFFECT = createSoundEffect({ instrument: INSTRUMENT, note: 'C-5', lengthMs: 50 });

describe('headless Audio80', () => {
    describe('with no options', () => {
        it('accepts every write, plays nothing, and runs its clock', () => {
            const { audio80, controls } = createHeadlessAudio80();
            writeOneOfEach(audio80);
            controls.update(TICK_MS);
            controls.update(TICK_MS);
            expect(audio80.time).toBe(TICK_MS + TICK_MS);
        });

        it('has neither a log nor a render', () => {
            const chip = createHeadlessAudio80();
            expect('log' in chip.audio80).toBe(false);
            expect('render' in chip).toBe(false);
        });

        it('clamps its volumes as every chip does', () => {
            expect(readClampedVolumes(createHeadlessAudio80())).toEqual([1, 0, MAX_MIX_VOLUME]);
        });
    });

    describe('with record', () => {
        it('logs every write with its stamp, an effect at -Infinity and the rest at atMs or the clock time', () => {
            const { audio80, controls } = createHeadlessAudio80({ record: true });
            controls.update(TICK_MS);
            writeOneOfEach(audio80);
            expect(audio80.log).toEqual(buildOneOfEachLog(TICK_MS));
        });

        it('empties its log on clear', () => {
            const { audio80 } = createHeadlessAudio80({ record: true });
            audio80.noteOff(0);
            audio80.clear();
            expect(audio80.log).toEqual([]);
        });

        it('keeps its log and its clock through flush, reset and destroy', async () => {
            const { audio80, controls } = createHeadlessAudio80({ record: true });
            await controls.ready;
            controls.update(TICK_MS);
            audio80.noteOff(0);
            controls.flush();
            controls.reset();
            controls.destroy();
            expect(audio80.log).toEqual([{ kind: 'note-off', voice: 0, time: TICK_MS }]);
            expect(audio80.time).toBe(TICK_MS);
        });

        it('clamps its volumes as every chip does', () => {
            expect(readClampedVolumes(createHeadlessAudio80({ record: true }))).toEqual([1, 0, MAX_MIX_VOLUME]);
        });

        it('has no render', () => {
            expect('render' in createHeadlessAudio80({ record: true })).toBe(false);
        });
    });

    describe('with render', () => {
        it('renders at 48 kHz unless told otherwise', () => {
            expect(createHeadlessAudio80({ render: true }).sampleRate).toBe(DEFAULT_SAMPLE_RATE);
            expect(createHeadlessAudio80({ render: { sampleRate: 22050 } }).sampleRate).toBe(22050);
        });

        it('renders what it is told to play, and nothing before', () => {
            const chip = createHeadlessAudio80({ render: true });
            expect(measurePeak(renderFrames(chip))).toBe(0);
            expect(measurePeak(playNote(chip))).toBeGreaterThan(0);
        });

        it('writes every sample of the buffer it is given, so a buffer can be reused', () => {
            const chip = createHeadlessAudio80({ render: true });
            const samples = new Float32Array(FRAMES).fill(1);
            chip.render(samples);
            expect(measurePeak(samples)).toBe(0);
        });

        it('keeps a music volume set just before a reset', () => {
            const quieter = createHeadlessAudio80({ render: true });
            quieter.controls.musicVolume = MUSIC_VOLUME;
            quieter.controls.reset();
            const asWritten = createHeadlessAudio80({ render: true });
            expect(measurePeak(playNote(quieter)) / measurePeak(playNote(asWritten))).toBeCloseTo(MUSIC_VOLUME, 1);
        });

        it('renders nothing when muted', () => {
            const chip = createHeadlessAudio80({ render: true });
            chip.controls.isMuted = true;
            expect(measurePeak(playNote(chip))).toBe(0);
        });

        it('clamps its volumes as every chip does', () => {
            expect(readClampedVolumes(createHeadlessAudio80({ render: true }))).toEqual([1, 0, MAX_MIX_VOLUME]);
        });

        it('has no log', () => {
            expect('log' in createHeadlessAudio80({ render: true }).audio80).toBe(false);
        });
    });

    describe('with record and render', () => {
        it('logs every write as recording alone does', () => {
            const { audio80, controls } = createHeadlessAudio80({ record: true, render: true });
            controls.update(TICK_MS);
            writeOneOfEach(audio80);
            expect(audio80.log).toEqual(buildOneOfEachLog(TICK_MS));
        });

        it('renders every write as rendering alone does', () => {
            const both = createHeadlessAudio80({ record: true, render: { character: 'clean' } });
            const renderOnly = createHeadlessAudio80({ render: { character: 'clean' } });
            const samples = playAndRender(both);
            expect(measurePeak(samples)).toBeGreaterThan(0);
            expect(hashSamples(samples)).toBe(hashSamples(playAndRender(renderOnly)));
        });
    });

    describe('with a wave or a filter mode set by name', () => {
        it('writes a wave as the waveform flags an instrument with that wave has', () => {
            const writer = createWriter();
            const waves: readonly Wave[] = ['saw+pulse', 'noise', 'wavetable'];
            for (let i = 0; i < waves.length; i++) writer.setVoice(2, 'wave', waves[i], 10);
            for (let i = 0; i < waves.length; i++) {
                expect(readCommand(writer, i)).toEqual([OP_SET_VOICE, 10, 2, VOICE_SETTING_INDEX.wave, createInstrument({ wave: waves[i] }).data.wave, 0]);
            }
        });

        it('writes a filter mode as its mode flags', () => {
            const writer = createWriter();
            writer.setFilter('b', 'mode', 'notch', 10);
            writer.setFilter('a', 'mode', 'lowpass', 20);
            expect(readCommand(writer, 0)).toEqual([OP_SET_FILTER, 10, 1, FILTER_SETTING_INDEX.mode, FILTER_LOWPASS | FILTER_HIGHPASS, 0]);
            expect(readCommand(writer, 1)).toEqual([OP_SET_FILTER, 20, 0, FILTER_SETTING_INDEX.mode, FILTER_LOWPASS, 0]);
        });

        it('plays a voice whose wave is set by name as an instrument with that wave plays', () => {
            const asSet = createHeadlessAudio80({ render: { character: 'clean' } });
            asSet.audio80.noteOn(0, createInstrument({ wave: 'triangle' }), 57, 1);
            asSet.audio80.setVoice(0, 'wave', 'saw+pulse');
            const asInstrument = createHeadlessAudio80({ render: { character: 'clean' } });
            asInstrument.audio80.noteOn(0, createInstrument({ wave: 'saw+pulse' }), 57, 1);
            const samples = renderFrames(asSet);
            expect(measurePeak(samples)).toBeGreaterThan(0);
            expect(hashSamples(samples)).toBe(hashSamples(renderFrames(asInstrument)));
        });

        it('filters with the mode named, so a low pass cuts a high note above a low cutoff and a high pass keeps it', () => {
            const lowPassed = renderFilteredNote('lowpass');
            const highPassed = renderFilteredNote('highpass');
            expect(measurePeak(lowPassed)).toBeLessThan(measurePeak(highPassed) / 10);
        });

        it('logs the name as written', () => {
            const { audio80 } = createHeadlessAudio80({ record: true });
            audio80.setVoice(3, 'wave', 'triangle+saw', 5);
            audio80.setFilter('a', 'mode', 'bandpass', 6);
            expect(audio80.log).toEqual([
                { kind: 'set-voice', voice: 3, setting: 'wave', value: 'triangle+saw', time: 5 },
                { kind: 'set-filter', filter: 'a', setting: 'mode', value: 'bandpass', time: 6 },
            ]);
        });

        it('accepts, in its type, a name for a wave or a mode and a number for every other setting', () => {
            const { audio80 } = createHeadlessAudio80();
            expectTypeOf(audio80.setVoice<'wave'>).parameter(2).toEqualTypeOf<Wave>();
            expectTypeOf(audio80.setVoice<'volume'>).parameter(2).toEqualTypeOf<number>();
            expectTypeOf(audio80.setFilter<'mode'>).parameter(2).toEqualTypeOf<FilterMode>();
            expectTypeOf(audio80.setFilter<'cutoffHz'>).parameter(2).toEqualTypeOf<number>();
            // @ts-expect-error: a wave is set by its name, not its flags
            audio80.setVoice(0, 'wave', 4);
            // @ts-expect-error: a filter mode is set by its name, not its flags
            audio80.setFilter('a', 'mode', 1);
            // @ts-expect-error: a cutoff is a number
            audio80.setFilter('a', 'cutoffHz', 'lowpass');
            // @ts-expect-error: a volume is a number
            audio80.setVoice(0, 'volume', 'pulse');
        });
    });

    it('has, in its type, a log only if made with record and render only if made with render', () => {
        const silent = createHeadlessAudio80();
        const recording = createHeadlessAudio80({ record: true });
        const rendering = createHeadlessAudio80({ render: true });
        const tuned = createHeadlessAudio80({ render: { sampleRate: 22050 } });
        const both = createHeadlessAudio80({ record: true, render: true });
        const neither = createHeadlessAudio80({ record: false, render: false });

        // @ts-expect-error: a chip made without record has no log to read
        expect(silent.audio80.log).toBeUndefined();
        // @ts-expect-error: a chip made without render has nothing to render
        expect(recording.render).toBeUndefined();

        expectTypeOf(silent.audio80).not.toHaveProperty('log');
        expectTypeOf(silent).not.toHaveProperty('render');
        expectTypeOf(neither.audio80).not.toHaveProperty('log');
        expectTypeOf(neither).not.toHaveProperty('render');
        expectTypeOf(recording.audio80.log).toEqualTypeOf<readonly ChipWrite[]>();
        expectTypeOf(recording).not.toHaveProperty('render');
        expectTypeOf(rendering.audio80).not.toHaveProperty('log');
        expectTypeOf(rendering.render).toEqualTypeOf<ChipRenderer['render']>();
        expectTypeOf(tuned.sampleRate).toEqualTypeOf<number>();
        expectTypeOf(both.audio80.log).toEqualTypeOf<readonly ChipWrite[]>();
        expectTypeOf(both.render).toEqualTypeOf<ChipRenderer['render']>();
        expectTypeOf(both).toExtend<HeadlessAudio80<{ render: true }>>();
    });
});

/** Makes one write of each kind: an effect, then the rest, some stamped and some not. */
function writeOneOfEach(audio80: HeadlessAudio80['audio80']): void {
    audio80.play(EFFECT);
    audio80.noteOn(0, INSTRUMENT, 60, 1);
    audio80.noteOff(0, 100);
    audio80.setVoice(1, 'volume', 0.5);
    audio80.setFilter('b', 'cutoffHz', 2000, 200);
    audio80.setEcho('level', 0.25);
    audio80.reserveVoices(4, 300);
    audio80.releaseAll();
}

/** What `writeOneOfEach` logs, made at chip time `time`. */
function buildOneOfEachLog(time: number): ChipWrite[] {
    return [
        { kind: 'play', effect: EFFECT, time: -Infinity },
        { kind: 'note-on', voice: 0, instrument: INSTRUMENT, note: 60, volume: 1, time },
        { kind: 'note-off', voice: 0, time: 100 },
        { kind: 'set-voice', voice: 1, setting: 'volume', value: 0.5, time },
        { kind: 'set-filter', filter: 'b', setting: 'cutoffHz', value: 2000, time: 200 },
        { kind: 'set-echo', setting: 'level', value: 0.25, time },
        { kind: 'reserve-voices', count: 4, time: 300 },
        { kind: 'release-all', time },
    ];
}

/** Sets each volume outside its range and reads back what the controls kept. */
function readClampedVolumes({ controls }: HeadlessAudio80): number[] {
    controls.volume = 3;
    controls.musicVolume = -1;
    controls.effectsVolume = MAX_MIX_VOLUME + 1;
    return [controls.volume, controls.musicVolume, controls.effectsVolume];
}

/** Starts a sustained note on a music voice and renders `FRAMES` samples of it. */
function playNote(chip: HeadlessAudio80<{ render: true }>): Float32Array {
    chip.audio80.noteOn(0, INSTRUMENT, 57, 1);
    return renderFrames(chip);
}

/** Renders the chip's next `FRAMES` samples into a new buffer. */
function renderFrames(chip: HeadlessAudio80<{ render: true }>): Float32Array {
    const samples = new Float32Array(FRAMES);
    chip.render(samples);
    return samples;
}

/** Creates a command Audio80 that sends its instruments and effects nowhere. */
function createWriter(): ReturnType<typeof createCommandAudio80> {
    return createCommandAudio80({ onInstrument: () => undefined, onEffect: () => undefined });
}

/** The writer's command at `index`, as its numbers. */
function readCommand(writer: ReturnType<typeof createCommandAudio80>, index: number): number[] {
    return Array.from(writer.commands.subarray(index * COMMAND_STRIDE, (index + 1) * COMMAND_STRIDE));
}

/**
 * Renders a high saw through filter `a`. The filter's mode is set by name to
 * `mode`, and its cutoff is at the bottom of its range.
 */
function renderFilteredNote(mode: FilterMode): Float32Array {
    const chip = createHeadlessAudio80({ render: { character: 'clean' } });
    chip.audio80.setFilter('a', 'mode', mode);
    chip.audio80.setFilter('a', 'cutoffHz', 20);
    chip.audio80.noteOn(0, createInstrument({ wave: 'saw', filter: 'a' }), 96, 1);
    return renderFrames(chip);
}

/** Plays an effect and a note, ticking and rendering as a game loop would. */
function playAndRender(chip: HeadlessAudio80<{ render: true }>): Float32Array {
    chip.audio80.play(EFFECT);
    chip.audio80.noteOn(0, INSTRUMENT, 57, 1);
    chip.controls.update(TICK_MS);
    chip.audio80.noteOff(0);
    return renderFrames(chip);
}

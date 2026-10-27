import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    type Audio80SoundOptions,
    type Audio80Writer,
    createCommandAudio80,
    createAudio80Sound,
    FILTER_HIGHPASS,
    FILTER_LOWPASS,
    FILTER_SETTING_INDEX,
    type Audio80FilterMode,
    OP_SET_FILTER,
    OP_SET_VOICE,
    VOICE_SETTING_INDEX,
    type Audio80Wave,
} from '../audio80';
import { COMMAND_STRIDE } from '../shared';
import { type Audio80Write, createHeadlessAudio80, type HeadlessAudio80 } from './headless-audio80';
import { hashSamples, measurePeak } from './render';

const VOLUME = 0.5;
/** A tenth of a second at the default 48 kHz. */
const FRAMES = 4800;
const DEFAULT_SAMPLE_RATE = 48000;
const TICK_MS = 1000 / 60;
const SAW: Audio80SoundOptions = { wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } };
const INSTRUMENT = createAudio80Sound(SAW);
const EFFECT = createAudio80Sound({ ...SAW, note: 'C-5', lengthMs: 50 });

describe('headless Audio80', () => {
    describe('with no options', () => {
        it('accepts every write, plays nothing, and runs its clock', () => {
            const chip = createHeadlessAudio80();
            writeOneOfEach(chip);
            chip.update(TICK_MS);
            chip.update(TICK_MS);
            expect(chip.time).toBe(TICK_MS + TICK_MS);
        });

        it('logs nothing, and refuses to render', () => {
            const chip = createHeadlessAudio80();
            writeOneOfEach(chip);
            expect(chip.log).toEqual([]);
            expect(() => renderFrames(chip)).toThrow('made without `render`');
        });

        it('clamps its volume as every chip does', () => {
            expect(readClampedVolumes(createHeadlessAudio80())).toEqual([1, 0]);
        });
    });

    describe('with record', () => {
        it('logs every write with its stamp, a play and a stop at -Infinity and the rest at atMs or the clock time', () => {
            const chip = createHeadlessAudio80({ record: true });
            chip.update(TICK_MS);
            writeOneOfEach(chip);
            expect(chip.log).toEqual(buildOneOfEachLog(TICK_MS));
        });

        it('empties its log on clear', () => {
            const chip = createHeadlessAudio80({ record: true });
            chip.stop();
            chip.clear();
            expect(chip.log).toEqual([]);
        });

        it('keeps its log and its clock through stop and destroy', async () => {
            const chip = createHeadlessAudio80({ record: true });
            await chip.ready;
            chip.update(TICK_MS);
            chip.setEcho('level', 0.5);
            chip.stop();
            chip.destroy();
            expect(chip.log).toEqual([{ kind: 'set-echo', setting: 'level', value: 0.5, time: TICK_MS }, { kind: 'stop', id: undefined, time: -Infinity }]);
            expect(chip.time).toBe(TICK_MS);
        });

        it('clamps its volume as every chip does', () => {
            expect(readClampedVolumes(createHeadlessAudio80({ record: true }))).toEqual([1, 0]);
        });

        it('refuses to render', () => {
            expect(() => renderFrames(createHeadlessAudio80({ record: true }))).toThrow('made without `render`');
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
            chip.renderInto(samples);
            expect(measurePeak(samples)).toBe(0);
        });

        it('renders at its volume, and keeps it as everything is stopped while paused, which cuts the voices', () => {
            const quieter = createHeadlessAudio80({ render: true });
            quieter.volume = VOLUME;
            quieter.pause();
            quieter.stop();
            quieter.resume();
            const asWritten = createHeadlessAudio80({ render: true });
            expect(measurePeak(playNote(quieter)) / measurePeak(playNote(asWritten))).toBeCloseTo(VOLUME, 1);
        });

        it('renders nothing when muted', () => {
            const chip = createHeadlessAudio80({ render: true });
            chip.isMuted = true;
            expect(measurePeak(playNote(chip))).toBe(0);
        });

        it('clamps its volume as every chip does', () => {
            expect(readClampedVolumes(createHeadlessAudio80({ render: true }))).toEqual([1, 0]);
        });

        it('logs nothing', () => {
            const chip = createHeadlessAudio80({ render: true });
            writeOneOfEach(chip);
            expect(chip.log).toEqual([]);
        });
    });

    describe('with record and render', () => {
        it('logs every write as recording alone does', () => {
            const chip = createHeadlessAudio80({ record: true, render: true });
            chip.update(TICK_MS);
            writeOneOfEach(chip);
            expect(chip.log).toEqual(buildOneOfEachLog(TICK_MS));
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
            const waves: readonly Audio80Wave[] = ['saw+pulse', 'noise', 'wavetable'];
            for (let i = 0; i < waves.length; i++) writer.setVoice(2, 'wave', waves[i], 10);
            for (let i = 0; i < waves.length; i++) {
                expect(readCommand(writer, i)).toEqual([OP_SET_VOICE, 10, 2, VOICE_SETTING_INDEX.wave, createAudio80Sound({ wave: waves[i] }).data.wave, 0]);
            }
        });

        it('writes a filter mode as its mode flags', () => {
            const writer = createWriter();
            writer.setFilter('b', 'mode', 'notch', 10);
            writer.setFilter('a', 'mode', 'lowpass', 20);
            expect(readCommand(writer, 0)).toEqual([OP_SET_FILTER, 10, 1, FILTER_SETTING_INDEX.mode, FILTER_LOWPASS | FILTER_HIGHPASS, 0]);
            expect(readCommand(writer, 1)).toEqual([OP_SET_FILTER, 20, 0, FILTER_SETTING_INDEX.mode, FILTER_LOWPASS, 0]);
        });

        it('plays a voice whose wave is set by name as a sound with that wave plays', () => {
            const asSet = createHeadlessAudio80({ render: { character: 'clean' } });
            asWriter(asSet).noteOn(0, createAudio80Sound({ wave: 'triangle' }), 57, 1);
            asSet.setVoice(0, 'wave', 'saw+pulse');
            const asSound = createHeadlessAudio80({ render: { character: 'clean' } });
            asWriter(asSound).noteOn(0, createAudio80Sound({ wave: 'saw+pulse' }), 57, 1);
            const samples = renderFrames(asSet);
            expect(measurePeak(samples)).toBeGreaterThan(0);
            expect(hashSamples(samples)).toBe(hashSamples(renderFrames(asSound)));
        });

        it('filters with the mode named, so a low pass cuts a high note above a low cutoff and a high pass keeps it', () => {
            const lowPassed = renderFilteredNote('lowpass');
            const highPassed = renderFilteredNote('highpass');
            expect(measurePeak(lowPassed)).toBeLessThan(measurePeak(highPassed) / 10);
        });

        it('logs the name as written', () => {
            const chip = createHeadlessAudio80({ record: true });
            chip.setVoice(3, 'wave', 'triangle+saw', 5);
            chip.setFilter('a', 'mode', 'bandpass', 6);
            expect(chip.log).toEqual([
                { kind: 'set-voice', voice: 3, setting: 'wave', value: 'triangle+saw', time: 5 },
                { kind: 'set-filter', filter: 'a', setting: 'mode', value: 'bandpass', time: 6 },
            ]);
        });

        it('accepts, in its type, a name for a wave or a mode and a number for every other setting', () => {
            const audio80 = createHeadlessAudio80();
            expectTypeOf(audio80.setVoice<'wave'>).parameter(2).toEqualTypeOf<Audio80Wave>();
            expectTypeOf(audio80.setVoice<'volume'>).parameter(2).toEqualTypeOf<number>();
            expectTypeOf(audio80.setFilter<'mode'>).parameter(2).toEqualTypeOf<Audio80FilterMode>();
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

    it('has one type, whatever its options', () => {
        expectTypeOf(createHeadlessAudio80()).toEqualTypeOf<HeadlessAudio80>();
        expectTypeOf(createHeadlessAudio80({ record: true, render: { sampleRate: 22050 } })).toEqualTypeOf<HeadlessAudio80>();
        expectTypeOf(createHeadlessAudio80().log).toEqualTypeOf<readonly Audio80Write[]>();
    });
});

/** Makes one write of each kind: a play and its stop, then a song's notes and the rest, some stamped and some not. */
function writeOneOfEach(audio80: HeadlessAudio80): void {
    const id = audio80.play(EFFECT, { note: 'C-4' });
    audio80.stop(id);
    asWriter(audio80).noteOn(0, INSTRUMENT, 60, 1);
    asWriter(audio80).noteOff(0, 100);
    audio80.setVoice(1, 'volume', 0.5);
    audio80.setFilter('b', 'cutoffHz', 2000, 200);
    audio80.setEcho('level', 0.25);
    audio80.stop();
}

/** What `writeOneOfEach` logs, made at chip time `time`. */
function buildOneOfEachLog(time: number): Audio80Write[] {
    return [
        { kind: 'play', sound: EFFECT, id: 1, options: { note: 'C-4' }, time: -Infinity },
        { kind: 'stop', id: 1, time: -Infinity },
        { kind: 'note-on', voice: 0, sound: INSTRUMENT, note: 60, volume: 1, time },
        { kind: 'note-off', voice: 0, time: 100 },
        { kind: 'set-voice', voice: 1, setting: 'volume', value: 0.5, time },
        { kind: 'set-filter', filter: 'b', setting: 'cutoffHz', value: 2000, time: 200 },
        { kind: 'set-echo', setting: 'level', value: 0.25, time },
        { kind: 'stop', id: undefined, time: -Infinity },
    ];
}

/** Sets the volume above and below its range, and reads back what the chip kept each time. */
function readClampedVolumes(chip: HeadlessAudio80): number[] {
    chip.volume = 3;
    const high = chip.volume;
    chip.volume = -1;
    return [high, chip.volume];
}

/** Starts a sustained note on a music voice and renders `FRAMES` samples of it. */
function playNote(chip: HeadlessAudio80): Float32Array {
    asWriter(chip).noteOn(0, INSTRUMENT, 57, 1);
    return renderFrames(chip);
}

/** Renders the chip's next `FRAMES` samples into a new buffer. */
function renderFrames(chip: HeadlessAudio80): Float32Array {
    const samples = new Float32Array(FRAMES);
    chip.renderInto(samples);
    return samples;
}

/** Creates a command Audio80 that sends its sounds nowhere. */
function createWriter(): ReturnType<typeof createCommandAudio80> {
    return createCommandAudio80({ onSound: () => undefined });
}

/**
 * The chip as its songs write to it, so a test can play a note on a voice it
 * chooses, as a song's note plays. A headless chip is its own writer, which its
 * songs write their notes through, so the cast only names what it already is.
 */
function asWriter(chip: HeadlessAudio80): Audio80Writer {
    return chip as HeadlessAudio80 & Audio80Writer;
}

/** The writer's command at `index`, as its numbers. */
function readCommand(writer: ReturnType<typeof createCommandAudio80>, index: number): number[] {
    return Array.from(writer.commands.subarray(index * COMMAND_STRIDE, (index + 1) * COMMAND_STRIDE));
}

/**
 * Renders a high saw through filter `a`. The filter's mode is set by name to
 * `mode`, and its cutoff is at the bottom of its range.
 */
function renderFilteredNote(mode: Audio80FilterMode): Float32Array {
    const chip = createHeadlessAudio80({ render: { character: 'clean' } });
    chip.setFilter('a', 'mode', mode);
    chip.setFilter('a', 'cutoffHz', 20);
    asWriter(chip).noteOn(0, createAudio80Sound({ wave: 'saw', filter: 'a' }), 96, 1);
    return renderFrames(chip);
}

/** Plays a sound and a song's note, ticking and rendering as a game loop would. */
function playAndRender(chip: HeadlessAudio80): Float32Array {
    chip.play(EFFECT);
    asWriter(chip).noteOn(0, INSTRUMENT, 57, 1);
    chip.update(TICK_MS);
    asWriter(chip).noteOff(0);
    return renderFrames(chip);
}

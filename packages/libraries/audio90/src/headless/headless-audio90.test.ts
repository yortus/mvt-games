import { describe, expect, expectTypeOf, it } from 'vitest';
import { AUDIO90_SCOPE_POINTS, type Audio90SoundOptions, type Audio90Writer, createAudio90Sound, HELD_ENVELOPE } from '../audio90';
import { MAX_MIX_VOLUME } from '../shared';
import { type Audio90Renderer, type Audio90Write, createHeadlessAudio90, type HeadlessAudio90 } from './headless-audio90';
import { hashSamples, measurePeak } from './render';
import type { StereoSamples } from './stereo-samples';

/** A tenth of a second at the default 48 kHz. */
const FRAMES = 4800;
const TICK_MS = 1000 / 60;
const SAW: Audio90SoundOptions = { oscillator: { wave: 'saw' }, envelope: HELD_ENVELOPE };
const INSTRUMENT = createAudio90Sound(SAW);
const EFFECT = createAudio90Sound({ ...SAW, note: 'C-5', lengthMs: 50 });

describe('headless Audio90', () => {
    describe('with no options', () => {
        it('accepts every write, plays nothing, and runs its clock', () => {
            const { audio90, controls } = createHeadlessAudio90();
            writeOneOfEach(audio90);
            controls.update(25);
            expect(audio90.time).toBe(25);
            expect(audio90.voiceCount).toBe(16);
        });

        it('clamps its volumes as every chip does', () => {
            expect(readClampedVolumes(createHeadlessAudio90())).toEqual([1, 0, MAX_MIX_VOLUME]);
        });
    });

    describe('with record', () => {
        it('logs every write with its stamp, a play and a stop at -Infinity with the options they were given', () => {
            const { audio90, controls } = createHeadlessAudio90({ record: true });
            controls.update(50);
            writeOneOfEach(audio90);
            expect(audio90.log).toEqual(buildOneOfEachLog(50));
        });

        it('empties its log on clear', () => {
            const { audio90 } = createHeadlessAudio90({ record: true });
            writeOneOfEach(audio90);
            audio90.clear();
            expect(audio90.log).toEqual([]);
        });
    });

    describe('with render', () => {
        it('renders what it is told to play into both channels, and nothing before', () => {
            const chip = createHeadlessAudio90({ render: true });
            expect(measurePeak(renderFrames(chip))).toBe(0);
            asWriter(chip.audio90).noteOn(0, INSTRUMENT, 57, 1);
            const { left, right } = renderFrames(chip);
            expect(measurePeak(left)).toBeGreaterThan(0.05);
            expect(measurePeak(right)).toBeGreaterThan(0.05);
        });

        it('pans a sound to the side it is played on', () => {
            const chip = createHeadlessAudio90({ render: true });
            chip.audio90.play(EFFECT, { pan: 1 });
            const { left, right } = renderFrames(chip);
            expect(measurePeak(right)).toBeGreaterThan(0.05);
            expect(measurePeak(left)).toBeLessThan(1e-6);
        });

        it('renders nothing when muted, and keeps a music volume set just before a reset', () => {
            const muted = createHeadlessAudio90({ render: true });
            muted.controls.isMuted = true;
            asWriter(muted.audio90).noteOn(0, INSTRUMENT, 57, 1);
            expect(measurePeak(renderFrames(muted))).toBe(0);

            const quiet = createHeadlessAudio90({ render: true });
            quiet.controls.musicVolume = 0.5;
            quiet.controls.reset();
            asWriter(quiet.audio90).noteOn(0, INSTRUMENT, 57, 1);
            const full = createHeadlessAudio90({ render: true });
            asWriter(full.audio90).noteOn(0, INSTRUMENT, 57, 1);
            expect(measurePeak(renderFrames(quiet))).toBeCloseTo(measurePeak(renderFrames(full)) * 0.5, 2);
        });

        it('renders at the sample rate it is given, in the character it is given', () => {
            const studio = createHeadlessAudio90({ render: { sampleRate: 32000 } });
            const consoleChip = createHeadlessAudio90({ render: { sampleRate: 32000, character: 'console' } });
            expect(studio.sampleRate).toBe(32000);
            const fm = createAudio90Sound({ engine: 'fm', operators: [{ ratio: 1 }], envelope: HELD_ENVELOPE });
            asWriter(studio.audio90).noteOn(0, fm, 57, 1);
            asWriter(consoleChip.audio90).noteOn(0, fm, 57, 1);
            expect(hashSamples(renderFrames(studio))).not.toBe(hashSamples(renderFrames(consoleChip)));
        });
    });

    describe('with render, and scopes', () => {
        it('fills its scope as it renders while scopes are on, and clears it as they are turned off or it resets', () => {
            const chip = createHeadlessAudio90({ render: true });
            asWriter(chip.audio90).noteOn(0, INSTRUMENT, 57, 1);
            renderFrames(chip);
            expect(measurePeak(chip.audio90.scope)).toBe(0);
            chip.audio90.setScopes(true);
            renderFrames(chip);
            expect(measurePeak(chip.audio90.scope.subarray(0, AUDIO90_SCOPE_POINTS))).toBeGreaterThan(0.05);
            chip.controls.reset();
            expect(measurePeak(chip.audio90.scope)).toBe(0);
            asWriter(chip.audio90).noteOn(0, INSTRUMENT, 57, 1);
            renderFrames(chip);
            expect(measurePeak(chip.audio90.scope)).toBe(0);
        });
    });

    describe('with record and render', () => {
        it('logs every write and renders it, as each does alone', () => {
            const both = createHeadlessAudio90({ record: true, render: true });
            const rendering = createHeadlessAudio90({ render: true });
            for (const chip of [both, rendering]) {
                chip.audio90.play(EFFECT);
                asWriter(chip.audio90).noteOn(0, INSTRUMENT, 57, 1);
                chip.controls.update(TICK_MS);
                asWriter(chip.audio90).noteOff(0);
            }
            expect(both.audio90.log).toHaveLength(3);
            expect(hashSamples(renderFrames(both))).toBe(hashSamples(renderFrames(rendering)));
        });
    });

    it('takes, in its type, only an effect\'s own settings', () => {
        const { audio90 } = createHeadlessAudio90();
        audio90.setEffect('echo', 'timeBeats', 0.75);
        // @ts-expect-error: the reverb has no feedback
        audio90.setEffect('reverb', 'feedback', 0.5);
        // @ts-expect-error: the chip has no such character
        audio90.setCharacter('classic');
    });

    it('has, in its type, a log only if made with record and render only if made with render', () => {
        const silent = createHeadlessAudio90();
        const recording = createHeadlessAudio90({ record: true });
        const rendering = createHeadlessAudio90({ render: true });
        const both = createHeadlessAudio90({ record: true, render: true });

        expectTypeOf(silent.audio90).not.toHaveProperty('log');
        expectTypeOf(silent).not.toHaveProperty('render');
        expectTypeOf(recording.audio90.log).toEqualTypeOf<readonly Audio90Write[]>();
        expectTypeOf(recording).not.toHaveProperty('render');
        expectTypeOf(rendering.audio90).not.toHaveProperty('log');
        expectTypeOf(rendering.render).toEqualTypeOf<Audio90Renderer['render']>();
        expectTypeOf(both.audio90.log).toEqualTypeOf<readonly Audio90Write[]>();
        expectTypeOf(both).toExtend<HeadlessAudio90<{ render: true }>>();
    });
});

/** Makes one write of each kind: a play and its stop, then a song's notes and the rest, some stamped and some not. */
function writeOneOfEach(audio90: HeadlessAudio90['audio90']): void {
    audio90.stop(audio90.play(EFFECT, { pan: -0.5 }));
    asWriter(audio90).noteOn(0, INSTRUMENT, 60, 1);
    asWriter(audio90).noteOff(0, 100);
    audio90.setVoice(1, 'brightness', 0.5);
    audio90.setEffect('reverb', 'level', 0.25, 200);
    audio90.setCharacter('sampler');
    audio90.setTempo(120, 300);
    audio90.reserveVoices(10);
    audio90.releaseAll();
}

/** What `writeOneOfEach` logs, made at chip time `time`. */
function buildOneOfEachLog(time: number): Audio90Write[] {
    return [
        { kind: 'play', sound: EFFECT, id: 1, options: { pan: -0.5 }, time: -Infinity },
        { kind: 'stop', id: 1, time: -Infinity },
        { kind: 'note-on', voice: 0, sound: INSTRUMENT, note: 60, volume: 1, time },
        { kind: 'note-off', voice: 0, time: 100 },
        { kind: 'set-voice', voice: 1, setting: 'brightness', value: 0.5, time },
        { kind: 'set-effect', effect: 'reverb', setting: 'level', value: 0.25, time: 200 },
        { kind: 'set-character', character: 'sampler', time },
        { kind: 'set-tempo', bpm: 120, time: 300 },
        { kind: 'reserve-voices', count: 10, time },
        { kind: 'release-all', time },
    ];
}

/** Sets each volume outside its range and reads back what the controls kept. */
function readClampedVolumes({ controls }: HeadlessAudio90): number[] {
    controls.volume = 3;
    controls.musicVolume = -1;
    controls.effectsVolume = MAX_MIX_VOLUME + 1;
    return [controls.volume, controls.musicVolume, controls.effectsVolume];
}

/** Renders the chip's next `FRAMES` samples into new buffers. */
function renderFrames(chip: HeadlessAudio90<{ render: true }>): StereoSamples {
    const left = new Float32Array(FRAMES);
    const right = new Float32Array(FRAMES);
    chip.render(left, right);
    return { left, right };
}

/**
 * The chip as its songs write to it, so a test can play a note on a voice it
 * chooses, as a song's note plays. A headless chip is its own writer, which its
 * songs write their notes through, so the cast only names what it already is.
 */
function asWriter(audio90: HeadlessAudio90['audio90']): Audio90Writer {
    return audio90 as typeof audio90 & Audio90Writer;
}

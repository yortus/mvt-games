import { describe, expect, it } from 'vitest';
import { AUDIO90_SAMPLE_MEMORY, createAudio90Song, formatAudio90Cell, prepareAudio90Samples } from '@mvtjs/chiptune';
import { hashSamples, LOUDNESS_TOLERANCE_LU, measureLoudness, measurePeak, REFERENCE_LOUDNESS_LUFS, renderSong } from '@mvtjs/chiptune/headless';
import { INSTRUMENT_NAMES } from './instrument-names';
import { SAMPLES } from './samples';
import { TUNES } from './tunes';

// Importing the data parses its notation, so a mistake in a pattern or a step
// table fails here. Each tune and effect is then rendered as the chip would
// play it, and its samples are hashed. A change to the chip or to the data
// that changes a sound makes that sound's test fail. Listen to the new sound
// first, then update the snapshot with `vitest -u`.

// Each tune is rendered whole, which takes a few seconds on a busy machine
describe('tunes', { timeout: 30_000 }, () => {
    it('bounces its samples within the chip\'s sample memory', () => {
        expect(SAMPLES.reduce((total, sample) => total + sample.length, 0)).toBeLessThanOrEqual(AUDIO90_SAMPLE_MEMORY);
        expect(() => prepareAudio90Samples(SAMPLES)).not.toThrow();
    });

    for (const tune of TUNES) {
        it(`${tune.name} sounds as it did, audible and unclipped, as loud as every other song`, () => {
            const samples = renderSong(tune.song);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(Math.abs(measureLoudness(samples) - REFERENCE_LOUDNESS_LUFS)).toBeLessThanOrEqual(LOUDNESS_TOLERANCE_LU);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    it('formats every cell of every tune as text that parses back into the same cell, as the Tune Tracker shows them', () => {
        for (const { song } of TUNES) {
            const instruments = Object.fromEntries(song.instrumentLetters.map((letter, i) => [letter, song.instruments[i]]));
            for (const pattern of song.patterns) {
                const rows: string[] = [];
                for (let row = 0; row < pattern.rowCount; row++) {
                    const texts: string[] = [];
                    for (let channel = 0; channel < song.channelCount; channel++) texts.push(formatAudio90Cell(song, pattern, row, channel));
                    rows.push(`| ${texts.join(' | ')}`);
                }
                const parsed = createAudio90Song({ bpm: song.bpm, instruments, patterns: { [pattern.name]: rows.join('\n') }, order: [pattern.name] });
                expect(Array.from(parsed.patterns[0].cells)).toEqual(Array.from(pattern.cells));
            }
        }
    });

    it('names every instrument a tune plays, in 15 characters or fewer', () => {
        for (const { song } of TUNES) {
            for (const instrument of song.instruments) expect(INSTRUMENT_NAMES.get(instrument)?.length ?? 0).toBeGreaterThan(0);
        }
        for (const name of INSTRUMENT_NAMES.values()) expect(name.length).toBeLessThanOrEqual(15);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Quieter than this, a sound is lost under the music. */
const AUDIBLE = 0.08;
/** The peak at which a sound counts as clipped. The output rounds off loud levels, so a peak never reaches 1. */
const CLIPPING = 0.9;

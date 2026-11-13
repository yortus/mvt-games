import { describe, expect, it } from 'vitest';
import { AUDIO90_SAMPLE_MEMORY, createAudio90Song, printAudio90Cell } from 'audio90';
import { INSTRUMENT_NAMES } from './instrument-names';
import { SAMPLES } from './samples';
import { TUNES } from './tunes';

// Importing the data parses its notation, so a mistake in a pattern or a step
// table fails here. How the tunes sound is checked by ear: `npm run
// audio:render` renders them to WAV files, and prints each one's peak and
// loudness beside the loudness every song shares.

describe('tunes', () => {
    // The chip makes this check as it bounces the samples, but bouncing them
    // takes most of a second.
    it('fits its samples in the chip\'s sample memory', () => {
        expect(SAMPLES.reduce((total, sample) => total + sample.length, 0)).toBeLessThanOrEqual(AUDIO90_SAMPLE_MEMORY);
    });

    it('formats every cell of every tune as text that parses back into the same cell, as the Tune Tracker shows them', () => {
        for (const { song } of TUNES) {
            const instruments = Object.fromEntries(song.instrumentLetters.map((letter, i) => [letter, song.instruments[i]]));
            for (const pattern of song.patterns) {
                const rows: string[] = [];
                for (let row = 0; row < pattern.rowCount; row++) {
                    const texts: string[] = [];
                    for (let channel = 0; channel < song.channelCount; channel++) texts.push(printAudio90Cell(song, pattern, row, channel));
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

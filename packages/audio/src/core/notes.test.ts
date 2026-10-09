import { describe, expect, it } from 'vitest';
import { toFrequency, HIGHEST_NOTE, HIGHEST_NOTE_NAME, toNoteNumber } from './notes';

describe('notes', () => {
    it('reads a note number from its name', () => {
        expect(toNoteNumber('C-4')).toBe(60);
        expect(toNoteNumber('A-4')).toBe(69);
        expect(toNoteNumber('F#5')).toBe(78);
        expect(toNoteNumber('H-4')).toBeUndefined();
    });

    it('names the highest note correctly', () => {
        expect(toNoteNumber(HIGHEST_NOTE_NAME)).toBe(HIGHEST_NOTE);
    });

    it('gives note 69 a frequency of 440 Hz, and doubles it an octave up', () => {
        expect(toFrequency(69)).toBe(440);
        expect(toFrequency(69 + 12)).toBeCloseTo(880, 9);
    });
});

import { describe, expect, it } from 'vitest';
import { toFrequency, HIGHEST_NOTE, HIGHEST_NOTE_NAME, toNoteName, toNoteNumber } from './notes';

describe('notes', () => {
    it('reads a note number from its name', () => {
        expect(toNoteNumber('C-4')).toBe(60);
        expect(toNoteNumber('A-4')).toBe(69);
        expect(toNoteNumber('F#5')).toBe(78);
        expect(toNoteNumber('H-4')).toBeUndefined();
    });

    it('names every note a song can write as it reads it back', () => {
        expect(toNoteName(60)).toBe('C-4');
        expect(toNoteName(78)).toBe('F#5');
        for (let note = 12; note <= HIGHEST_NOTE; note++) expect(toNoteNumber(toNoteName(note))).toBe(note);
        expect(() => toNoteName(11)).toThrow('note 11 has no name');
        expect(() => toNoteName(HIGHEST_NOTE + 1)).toThrow();
    });

    it('names the highest note correctly', () => {
        expect(toNoteNumber(HIGHEST_NOTE_NAME)).toBe(HIGHEST_NOTE);
    });

    it('gives note 69 a frequency of 440 Hz, and doubles it an octave up', () => {
        expect(toFrequency(69)).toBe(440);
        expect(toFrequency(69 + 12)).toBeCloseTo(880, 9);
    });
});

import { describe, expect, it } from 'vitest';
import { BLOCKED_INITIALS, INITIALS_CHARACTERS, INITIALS_LENGTH, findInitialsProblem, isValidInitials } from './initials';

const A_LETTER = INITIALS_CHARACTERS[0];

/** Initials of the right length, each character `char`. */
function initialsOf(char: string): string {
    return char.repeat(INITIALS_LENGTH);
}

describe('initials', () => {
    it('takes every character in the set, in every position', () => {
        for (const char of INITIALS_CHARACTERS) {
            for (let position = 0; position < INITIALS_LENGTH; position++) {
                const initials = initialsOf(A_LETTER).slice(0, position) + char + initialsOf(A_LETTER).slice(position + 1);
                expect(findInitialsProblem(initials), initials).toBeUndefined();
            }
        }
    });

    it('refuses initials of any other length', () => {
        expect(findInitialsProblem('')).toBe('length');
        expect(findInitialsProblem(A_LETTER.repeat(INITIALS_LENGTH - 1))).toBe('length');
        expect(findInitialsProblem(A_LETTER.repeat(INITIALS_LENGTH + 1))).toBe('length');
    });

    it('refuses characters not in the set, lowercase included', () => {
        for (const char of ['a', 'z', '!', '-', '\t', 'É']) {
            expect(INITIALS_CHARACTERS.includes(char)).toBe(false);
            expect(findInitialsProblem(initialsOf(A_LETTER).slice(1) + char), char).toBe('character');
        }
    });

    it('refuses all spaces, but takes spaces beside other characters', () => {
        expect(findInitialsProblem(initialsOf(' '))).toBe('blank');
        expect(findInitialsProblem(A_LETTER + initialsOf(' ').slice(1))).toBeUndefined();
    });

    it('refuses blocked words, and digits standing in for their letters', () => {
        for (const word of BLOCKED_INITIALS) {
            expect(word).toHaveLength(INITIALS_LENGTH);
            expect(findInitialsProblem(word), word).toBe('blocked');
        }
        expect(BLOCKED_INITIALS.has('ASS')).toBe(true);
        expect(findInitialsProblem('A55')).toBe('blocked');
        expect(findInitialsProblem('A5S')).toBe('blocked');
    });

    it('says whether initials are valid', () => {
        expect(isValidInitials(initialsOf(A_LETTER))).toBe(true);
        expect(isValidInitials(initialsOf(' '))).toBe(false);
    });
});

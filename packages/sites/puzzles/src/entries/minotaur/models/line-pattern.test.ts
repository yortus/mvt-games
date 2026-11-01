import { describe, expect, it } from 'vitest';
import { PASSAGE, UNKNOWN, WALL } from './edge-states';
import { createLinePattern } from './line-pattern';

// Lines are written as text, an edge to a letter: `.` unknown, `p` passage, `w` wall.

describe('LinePattern', () => {
    it('fits stretches of the clue\'s lengths, in order, with passages between', () => {
        expect(fits([2, 1], 'wwpw')).toBe(true);
        expect(fits([2, 1], 'pwwpwp')).toBe(true);
        expect(fits([2, 1], 'wpww')).toBe(false);
        expect(fits([2, 1], 'wwwp')).toBe(false);
        expect(fits([], 'ppp')).toBe(true);
        expect(fits([], 'pwp')).toBe(false);
        expect(fits([3], 'w..')).toBe(true);
        expect(fits([3], 'wp.')).toBe(false);
    });

    it('settles the edges every fit agrees on, and leaves the rest', () => {
        expect(narrow([3], '....')).toBe('.ww.');
        expect(narrow([2, 1], '....')).toBe('wwpw');
        expect(narrow([1], 'p...')).toBe('p...');
        expect(narrow([1, 1], '.....')).toBe('.....');
        expect(narrow([], '...')).toBe('ppp');
        expect(narrow([2], '.w.p')).toBe('.w.p');
        expect(narrow([2], 'w...')).toBe('wwpp');
    });

    it('says when nothing fits', () => {
        const states = toStates('wpw');
        expect(createLinePattern({ clue: [3], length: 3 }).narrow(states, edgesOf(3))).toBe(-1);
    });
});

function fits(clue: number[], line: string): boolean {
    return createLinePattern({ clue, length: line.length }).fits(toStates(line), edgesOf(line.length));
}

function narrow(clue: number[], line: string): string {
    const states = toStates(line);
    createLinePattern({ clue, length: line.length }).narrow(states, edgesOf(line.length));
    return Array.from(states, (state) => LETTERS[state]).join('');
}

const LETTERS: Record<number, string> = { [UNKNOWN]: '.', [PASSAGE]: 'p', [WALL]: 'w' };

function toStates(line: string): Uint8Array {
    return Uint8Array.from(line, (letter) => (letter === 'p' ? PASSAGE : letter === 'w' ? WALL : UNKNOWN));
}

function edgesOf(length: number): Int32Array {
    return Int32Array.from({ length }, (_, i) => i);
}

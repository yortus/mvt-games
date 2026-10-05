import { describe, expect, it } from 'vitest';
import { searchWordsOf as wordsOf } from '../models';
import { labelMatches, stepSuggestion } from './search-suggestions';

describe('search suggestions', () => {
    it('splits text into lower-case words', () => {
        expect(wordsOf('  Three.js  3D ')).toEqual(['three.js', '3d']);
        expect(wordsOf('')).toEqual([]);
    });

    it('matches a label when each word typed begins one of its words', () => {
        expect(labelMatches(wordsOf('Simulation'), wordsOf('sim'))).toBe(true);
        expect(labelMatches(wordsOf('three.js'), wordsOf('Three'))).toBe(true);
        expect(labelMatches(wordsOf('Simulation'), wordsOf('ulation'))).toBe(false);
        expect(labelMatches(wordsOf('Simulation'), wordsOf('sim x'))).toBe(false);
    });

    it('matches every label when nothing is typed', () => {
        expect(labelMatches(wordsOf('Maze'), [])).toBe(true);
    });

    it('steps to the next or previous suggestion, skipping the rest and wrapping', () => {
        const shown = [false, true, false, true, true];
        const step = (from: number, by: 1 | -1): number => stepSuggestion({
            from, step: by, count: shown.length, isSuggested: (i) => shown[i],
        });
        expect(step(-1, 1)).toBe(1);
        expect(step(-1, -1)).toBe(4);
        expect(step(1, 1)).toBe(3);
        expect(step(4, 1)).toBe(1);
        expect(step(1, -1)).toBe(4);
    });

    it('steps nowhere when nothing is suggested', () => {
        expect(stepSuggestion({ from: -1, step: 1, count: 3, isSuggested: () => false })).toBe(-1);
    });
});

import { expect, it } from 'vitest';
import { CATALOGUE } from '../../entries';
import { PUZZLE_ENTRIES } from './puzzle-entries';

// A puzzle added to the catalogue but not to the paper would be missing from it, with nothing to say so
it('puts every puzzle in the catalogue in the paper', () => {
    expect(PUZZLE_ENTRIES.map((entry) => entry.id).sort()).toEqual(CATALOGUE.map((entry) => entry.id).sort());
});

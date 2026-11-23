import { expect, it } from 'vitest';
import { CATALOGUE } from '../../entries';
import { CABINET_ENTRIES } from './cabinet-entries';
import { CABINETS_PER_WALL } from './constants';

// A game added to the catalogue but not to the hall would be missing from it, with nothing to say so
it('gives every game in the catalogue a cabinet, and fits them all along the hall\'s two walls', () => {
    expect(CABINET_ENTRIES.map((entry) => entry.id).sort()).toEqual(CATALOGUE.map((entry) => entry.id).sort());
    expect(CABINET_ENTRIES.length).toBeLessThanOrEqual(2 * CABINETS_PER_WALL);
});

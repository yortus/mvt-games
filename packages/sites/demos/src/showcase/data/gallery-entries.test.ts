import { expect, it } from 'vitest';
import { CATALOGUE } from '../../entries';
import { GALLERY_ENTRIES } from './gallery-entries';
import { HANGING_SPOTS } from './layout';

// A demo added to the catalogue but not to the gallery would be missing from it, with nothing to say so
it('gives every demo in the catalogue a painting, and has room on the walls for them all', () => {
    expect(GALLERY_ENTRIES.map((entry) => entry.id).sort()).toEqual(CATALOGUE.map((entry) => entry.id).sort());
    expect(GALLERY_ENTRIES.length).toBeLessThanOrEqual(HANGING_SPOTS.length);
});

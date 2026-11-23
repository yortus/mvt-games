import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import { findEntry } from '../../entries';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The puzzles in the paper, one on each spread. Each day's paper puts them in
 * its own order. Only their metadata is read here, from the catalogue. A
 * puzzle's code loads when someone steps up to play it.
 */
export const PUZZLE_ENTRIES: readonly ArcadeEntry[] = [
    'sudoku',
    'stars',
    'boats',
    'river',
    'minotaur',
    'rosette',
].map(findListed);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The puzzle with `id`, which the site's catalogue lists. */
function findListed(id: string): ArcadeEntry {
    const entry = findEntry(id);
    if (entry === undefined) throw new Error(`newspaper: the catalogue doesn't list a puzzle '${id}'`);
    return entry;
}

import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import { entry as minotaurEntry } from './minotaur';
import { entry as rosetteEntry } from './rosette';
import { entry as sudokuEntry } from './sudoku';

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * Every puzzle the puzzles site lists, in no particular order: its page shows them
 * by name. Only metadata: each entry's code loads when it starts.
 */
export const CATALOGUE: readonly ArcadeEntry[] = [
    sudokuEntry,
    minotaurEntry,
    rosetteEntry,
];

/** The entry with `id`, if there is one. */
export function findEntry(id: string): ArcadeEntry | undefined {
    for (let i = 0; i < CATALOGUE.length; i++) {
        if (CATALOGUE[i].id === id) return CATALOGUE[i];
    }
    return undefined;
}

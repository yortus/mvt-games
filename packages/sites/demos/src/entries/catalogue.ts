import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import { entry as boidsEntry } from './boids';
import { entry as boids3dEntry } from './boids-3d';
import { entry as coralEntry } from './coral';
import { entry as doublePendulumEntry } from './double-pendulum';
import { entry as fallingSandEntry } from './falling-sand';
import { entry as fireworksEntry } from './fireworks';
import { entry as fractalForestEntry } from './fractal-forest';
import { entry as fractalscopeEntry } from './fractalscope';
import { entry as fruitMachineEntry } from './fruit-machine';
import { entry as reorderingListsEntry } from './reordering-lists';
import { entry as sudokuDiggerEntry } from './sudoku-digger';
import { entry as tuneTrackerEntry } from './tune-tracker';

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * Every demo the demos site lists, in no particular order: its page shows them
 * by name. Only metadata: each entry's code loads when it starts.
 */
export const CATALOGUE: readonly ArcadeEntry[] = [
    fruitMachineEntry,
    fallingSandEntry,
    boids3dEntry,
    boidsEntry,
    reorderingListsEntry,
    fractalscopeEntry,
    doublePendulumEntry,
    fireworksEntry,
    tuneTrackerEntry,
    coralEntry,
    fractalForestEntry,
    sudokuDiggerEntry,
];

/** The entry with `id`, if there is one. */
export function findEntry(id: string): ArcadeEntry | undefined {
    for (let i = 0; i < CATALOGUE.length; i++) {
        if (CATALOGUE[i].id === id) return CATALOGUE[i];
    }
    return undefined;
}

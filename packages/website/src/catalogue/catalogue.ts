import type { ArcadeEntry } from '../entries';
import {
    astrovoidEntry, burrowBustEntry, crumbChaseEntry, dojoDuelEntry, fuelRunEntry, galaxyRaidersEntry, kwazyCactiiEntry,
    neonMonsoonEntry,
} from '../games';
import { boids3dEntry, boidsEntry, fallingSandEntry, fruitMachineEntry, reorderingListsEntry } from '../demos';

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * Every entry the site lists, in no particular order: the arcade shows them
 * by name. Only metadata: each entry's code loads when it starts.
 */
export const CATALOGUE: readonly ArcadeEntry[] = [
    neonMonsoonEntry,
    fruitMachineEntry,
    crumbChaseEntry,
    fallingSandEntry,
    galaxyRaidersEntry,
    boids3dEntry,
    burrowBustEntry,
    dojoDuelEntry,
    boidsEntry,
    kwazyCactiiEntry,
    reorderingListsEntry,
    fuelRunEntry,
    astrovoidEntry,
];

/** The entry with `id`, if there is one. */
export function findEntry(id: string): ArcadeEntry | undefined {
    for (let i = 0; i < CATALOGUE.length; i++) {
        if (CATALOGUE[i].id === id) return CATALOGUE[i];
    }
    return undefined;
}

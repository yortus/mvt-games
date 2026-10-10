import type { ArcadeEntry } from '../entry-types';
import { entry as astrovoidEntry } from './astrovoid';
import { entry as boidsEntry } from './boids';
import { entry as boids3dEntry } from './boids-3d';
import { entry as burrowBustEntry } from './burrow-bust';
import { entry as crumbChaseEntry } from './crumb-chase';
import { entry as dojoDuelEntry } from './dojo-duel';
import { entry as fallingSandEntry } from './falling-sand';
import { entry as fruitMachineEntry } from './fruit-machine';
import { entry as fuelRunEntry } from './fuel-run';
import { entry as galaxyRaidersEntry } from './galaxy-raiders';
import { entry as kwazyCactiiEntry } from './kwazy-cactii';
import { entry as mandelbrotDiveEntry } from './mandelbrot-dive';
import { entry as neonMonsoonEntry } from './neon-monsoon';
import { entry as reorderingListsEntry } from './reordering-lists';

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
    mandelbrotDiveEntry,
];

/** The entry with `id`, if there is one. */
export function findEntry(id: string): ArcadeEntry | undefined {
    for (let i = 0; i < CATALOGUE.length; i++) {
        if (CATALOGUE[i].id === id) return CATALOGUE[i];
    }
    return undefined;
}

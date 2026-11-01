import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import { entry as astrovoidEntry } from './astrovoid';
import { entry as burrowBustEntry } from './burrow-bust';
import { entry as crumbChaseEntry } from './crumb-chase';
import { entry as deepDiveEntry } from './deep-dive';
import { entry as dojoDuelEntry } from './dojo-duel';
import { entry as fencelineEntry } from './fenceline';
import { entry as fuelRunEntry } from './fuel-run';
import { entry as galaxyRaidersEntry } from './galaxy-raiders';
import { entry as gardenSnakeEntry } from './garden-snake';
import { entry as kwazyCactiiEntry } from './kwazy-cactii';
import { entry as neonMonsoonEntry } from './neon-monsoon';

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * Every game the arcade site lists, in no particular order: its page shows them
 * by name. Only metadata: each entry's code loads when it starts.
 */
export const CATALOGUE: readonly ArcadeEntry[] = [
    neonMonsoonEntry,
    crumbChaseEntry,
    galaxyRaidersEntry,
    burrowBustEntry,
    dojoDuelEntry,
    kwazyCactiiEntry,
    fuelRunEntry,
    astrovoidEntry,
    fencelineEntry,
    deepDiveEntry,
    gardenSnakeEntry,
];

/** The entry with `id`, if there is one. */
export function findEntry(id: string): ArcadeEntry | undefined {
    for (let i = 0; i < CATALOGUE.length; i++) {
        if (CATALOGUE[i].id === id) return CATALOGUE[i];
    }
    return undefined;
}

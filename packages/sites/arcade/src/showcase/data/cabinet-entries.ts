import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import { findEntry } from '../../entries';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The games in the hall's cabinets, one for each game in the catalogue, in
 * an order chosen by hand. The first six stand along one wall, from the
 * entrance, and the rest along the other. Only their metadata is read here.
 * A game's code loads as the visitor comes near its cabinet.
 */
export const CABINET_ENTRIES: readonly ArcadeEntry[] = [
    'galaxy-raiders',
    'astrovoid',
    'burrow-bust',
    'crumb-chase',
    'neon-monsoon',
    'chicane',
    'fuel-run',
    'fenceline',
    'dojo-duel',
    'deep-dive',
    'garden-snake',
    'kwazy-cactii',
].map(findListed);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The game with `id`, which the site's catalogue lists. */
function findListed(id: string): ArcadeEntry {
    const entry = findEntry(id);
    if (entry === undefined) throw new Error(`arcade hall: the catalogue lists no game '${id}'`);
    return entry;
}

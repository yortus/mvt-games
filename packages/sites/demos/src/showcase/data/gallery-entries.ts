import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import { findEntry } from '../../entries';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The demos on the gallery's walls, one to each painting, one for each demo
 * in the catalogue, in the order the visitor comes to them. A new demo needs
 * a new hanging spot too (`HANGING_SPOTS`, in `layout.ts`). Only their metadata is read
 * here, from the catalogue. A demo's code loads as the visitor comes near
 * its painting.
 */
export const GALLERY_ENTRIES: readonly ArcadeEntry[] = [
    'fireworks',
    'coral',
    'boids',
    'fractal-forest',
    'falling-sand',
    'orrery',
    'penrose-tiling',
    'double-pendulum',
    'fractalscope',
    'boids-3d',
    'tune-tracker',
    'fruit-machine',
    'reordering-lists',
    'sudoku-digger',
].map(findListed);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The demo with `id`, which the site's catalogue lists. */
function findListed(id: string): ArcadeEntry {
    const entry = findEntry(id);
    if (entry === undefined) throw new Error(`gallery: the catalogue doesn't list a demo '${id}'`);
    return entry;
}

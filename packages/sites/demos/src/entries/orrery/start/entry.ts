import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The orrery, as the demos site lists it. Its code loads on launch, from `load.ts`, and its long text after the first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'orrery',
    name: 'Orrery',
    summary: 'A brass orrery in 3D, its worlds turned by a train of gears. Walk round it, and run time fast, slow or backwards.',
    tags: ['simulation', '3d', 'sound'],
    screenWidth: 480,
    screenHeight: 360,
    thumbnail,
    // The picture centres on the sun and the tubes under it, so a square crop keeps them in view
    thumbnailFocus: { x: 240, y: 180 },
    cardColor: 'lavender',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};

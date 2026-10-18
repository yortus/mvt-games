import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fractalscope, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fractalscope',
    name: 'Fractalscope',
    summary: 'Zoom into eight fractals, from the Mandelbrot set to the Burning Ship, with a pinch or the mouse wheel.',
    tags: { kind: 'demo', genres: ['ui', 'art'] },
    // It fills whatever it is given; this is the shape of a typical one.
    screenWidth: 1280,
    screenHeight: 800,
    thumbnail,
    // The colour of its ember palette
    cardColor: 'apricot',
    // A square of the image around the set, left of the panel
    thumbnailCrop: { x: 40, y: 0, width: 800, height: 800 },
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};

import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The double pendulum, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'double-pendulum',
    name: 'Double Pendulum',
    summary: 'A pendulum hung from a pendulum swings in chaos. Step it a frame at a time, slow it down, or speed it up.',
    tags: { kind: 'demo', genres: ['simulation', 'tiny'] },
    screenWidth: 360,
    screenHeight: 420,
    thumbnail,
    cardColor: 'sky',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};

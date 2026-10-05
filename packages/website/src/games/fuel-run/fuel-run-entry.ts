import type { ArcadeEntry } from '../../entries';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fuel Run, as the arcade lists it. Its code loads on launch, from `fuel-run-starter.ts`. */
export const fuelRunEntry: ArcadeEntry = {
    id: 'fuel-run',
    name: 'Fuel Run',
    summary: 'Fly low over scrolling terrain, bombing fuel tanks to keep flying, while rockets and saucers rise to meet you.',
    description: [
        'A side-scrolling shooter. Your ship burns fuel as it flies; bomb the tanks on the ground to refill '
        + 'it, and shoot or dodge the rockets and saucers that launch at you.',
        'The largest of the games, with a model for every kind of thing in the world, tested on its own.',
    ].join('\n\n'),
    tags: { kind: 'game', era: '1980s', genres: ['shooter', 'scrolling'] },
    screenWidth: 448,
    screenHeight: 248,
    thumbnail,
    // The colour of its hills
    cardColor: 'mint',
    load: async () => (await import('./fuel-run-starter')).loadFuelRunStarter(),
};

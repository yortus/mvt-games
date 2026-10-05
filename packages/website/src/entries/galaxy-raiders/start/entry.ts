import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Galaxy Raiders, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'galaxy-raiders',
    name: 'Galaxy Raiders',
    summary: 'Hold off waves of raiders that break formation to dive at your ship.',
    description: [
        'A fixed shooter. Raiders fly in to form ranks above you, then peel off in curving dives, firing as they come.',
        'Each wave is data, and each raider a small model with its own phase: flying in, in formation, or diving.',
    ].join('\n\n'),
    tags: { kind: 'game', era: '1970s', genres: ['shooter'] },
    screenWidth: 280,
    screenHeight: 390,
    thumbnail,
    // The colour of its raiders
    cardColor: 'lavender',
    load: async () => (await import('./load')).load(),
};

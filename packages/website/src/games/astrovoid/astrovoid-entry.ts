import type { ArcadeEntry } from '../../entries';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Astrovoid, as the arcade lists it. Its code loads on launch, from `astrovoid-starter.ts`. */
export const astrovoidEntry: ArcadeEntry = {
    id: 'astrovoid',
    name: 'Astrovoid',
    summary: 'Rotate, thrust and fire to break drifting rocks into ever smaller pieces, in an arena that wraps at its edges.',
    description: [
        'A vector-style space shooter. Your ship turns, thrusts and fires; each rock you hit splits into '
        + 'smaller, faster ones, and anything that leaves one edge of the arena comes back at the other.',
        'Every ship, rock and bullet is a model in world units, and the views turn those into pixels.',
    ].join('\n\n'),
    tags: { kind: 'game', era: '1970s', genres: ['shooter'] },
    screenWidth: 400,
    screenHeight: 430,
    thumbnail,
    load: async () => (await import('./astrovoid-starter')).loadAstrovoidStarter(),
};

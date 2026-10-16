import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Garden Snake, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'garden-snake',
    name: 'Garden Snake',
    summary: 'Steer a hungry snake round the garden. Every berry makes it longer, and faster.',
    description: [
        'A snake game. Each berry adds a segment and quickens the pace, and running into the fence or your own tail ends it.',
        'It is one of the smallest games here: one model and one view. The model keeps the snake in whole cells, and '
        + 'gives each segment a fractional row and column as it slides between them. The view only turns rows and columns '
        + 'into pixels, so the snake glides rather than jumps.',
    ].join('\n\n'),
    instructions: [
        'Eat the berries; each makes you',
        'longer and faster.',
        'Hitting the fence or yourself',
        'ends the game.',
        '',
        'Arrows / WASD: steer',
        'On a touch screen, swipe to steer.',
        'Enter restarts after a game over.',
    ].join('\n'),
    tags: { kind: 'game', era: '1970s', genres: ['action', 'tiny'] },
    screenWidth: 256,
    screenHeight: 280,
    thumbnail,
    cardColor: 'mint',
    load: async () => (await import('./load')).load(),
};

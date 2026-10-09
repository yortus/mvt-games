import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Crumb Chase, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'crumb-chase',
    name: 'Crumb Chase',
    summary: 'Eat every crumb in the maze before the cats from the pen catch you.',
    description: [
        'A maze chase. You are a mouse clearing a maze of crumbs; cats leave their pen one by one and hunt '
        + 'you through the corridors.',
        'The first game in the repo, and a small one: a good place to start reading. Movement is tile to tile '
        + 'in fractional rows and columns, which the views scale to pixels.',
    ].join('\n\n'),
    instructions: [
        'Eat every crumb in the maze to win.',
        '',
        'Move: arrows / WASD / joystick',
        'Press a way early: you turn at the',
        'next corner that opens that way.',
        '',
        'The cats leave their pen one by',
        'one, and each hunts you its own',
        'way. One touch and the game is',
        'over. Enter restarts.',
    ].join('\n'),
    tags: { kind: 'game', era: '1980s', genres: ['maze'] },
    screenWidth: 560,
    screenHeight: 470,
    inspiredBy: { title: 'Pac-Man', maker: 'Namco', year: 1980 },
    thumbnail,
    // The colour of its crumbs
    cardColor: 'lemon',
    load: async () => (await import('./load')).load(),
};

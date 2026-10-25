import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Crumb Chase's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A maze chase. You are a mouse clearing a maze of crumbs; cats leave their pen one by one and hunt '
        + 'you through the corridors.',
    implementation: 'The first game in the repo, and a small one: a good place to start reading. Movement is tile to tile '
        + 'in fractional rows and columns, which the views scale to pixels.',
    howToPlay: {
        intro: 'Eat every crumb in the maze to win.',
        controls: [
            { action: 'Move', inputs: ['arrows', 'wasd', 'swipe'] },
            { action: 'Restart', inputs: ['enter'] },
        ],
        notes: [
            'Press or swipe a way early: you turn at the next corner that opens that way.',
            'The cats leave their pen one by one. By turns they slink off to their corners, then hunt you, each its own way. One touch and the game is over.',
        ],
    },
};

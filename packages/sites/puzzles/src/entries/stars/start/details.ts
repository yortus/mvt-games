import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Stars' long text, for its info panel and the search. The page loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A logic puzzle in which you place stars that never touch, a kind of puzzle known elsewhere as Star Battle. The '
        + 'grid is cut into as many regions as it has rows, and every row, every column and every region holds two '
        + 'stars. No two stars touch, not even diagonally, and that one rule does most of the work: each star you place '
        + 'rules out the eight cells round it.',
        'There is a new puzzle every day at each of four levels: Easy and Medium on 8 by 8 grids, Hard on 9 by 9, and '
        + 'Expert on 10 by 10. Each puzzle prints a few stars and dots on the grid, '
        + 'as few as it needs, so that it can always be solved by looking, with nothing guessed. Everyone gets the same puzzles on the '
        + 'same day, and every day back to the start of 2026 can still be played. Each puzzle you solve is ticked off on '
        + 'the calendar, and one you leave half done is kept just as you left it.',
    ].join('\n\n'),
    implementation: [
        'Each puzzle is made the moment it opens, from a seed worked out from its date and level, so every player\'s game '
        + 'makes the same one without asking a server. The maker works backwards from the answer. It lays out the stars, '
        + 'then grows a piece of region round each star, and pairs the pieces up, so each region holds two.',
        'Then a solver works the puzzle as a person would, by looking: it rules out the cells round each star, fills lines '
        + 'that have only as many cells left as stars they need, counts regions inside bands of rows, sees where a star would '
        + 'leave a line no room, and covers pairs of rows with 2x2 boxes. It never supposes a star and follows it. Wherever '
        + 'the easy steps run out, it asks for at least two cells it can find next, so you never hunt the whole board for '
        + 'one. Wherever it gets stuck, the maker prints the answer for one cell, a star or a dot, and goes on. Then it takes each printed '
        + 'cell away again, keeping only those the solver can\'t do without. A puzzle the solver finishes can only have one '
        + 'answer.',
    ].join('\n\n'),
    howToPlay: {
        intro: HOW_TO_PLAY.rules.join(' '),
        controls: [
            { action: 'Choose a day', inputs: ['click', 'tap'], note: 'Pick a level from the tabs first' },
            ...HOW_TO_PLAY.controls,
            { action: 'How to play', inputs: [{ button: 'How to play' }], note: 'Shows the rules again, and Show me walks you through the controls' },
        ],
        notes: HOW_TO_PLAY.notes,
    },
};

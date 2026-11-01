import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Minotaur's long text, for its info panel and the search. The page loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A logic puzzle in which you build a maze from clues on its walls, a kind of puzzle known elsewhere as Build a Maze '
        + 'or Labyrinth. The maze has one way through: a single path from S to E that passes through every cell once. Every '
        + 'side of a cell the path doesn\'t cross is a wall, and the numbers along the top and down the left say how long '
        + 'each stretch of wall on that line is, in order, as in a paint-by-numbers puzzle.',
        'There is a new maze every day at each of four levels, from Easy, a 5 by 5 grid, to Expert, 11 by 11. Everyone gets '
        + 'the same mazes on the same day, and every day back to the start of 2026 can still be played. Each maze you build '
        + 'is ticked off on the calendar, and one you leave half done is kept just as you left it.',
    ].join('\n\n'),
    implementation: [
        'Each maze is made the moment it opens, from a seed worked out from its date and level, so every player\'s game makes '
        + 'the same one without asking a server. A maker draws a random path through every cell by "backbite" moves: it '
        + 'joins an end of the path to a cell beside it, and turns the loose piece round. The walls are whatever the path '
        + 'leaves, and the clues are read off them.',
        'A solver then works the clues as a person would. It settles each line like a nonogram\'s, gives every cell two '
        + 'passages (the ends one), and walls off anything that would close a loop. At the harder levels it also tries '
        + 'edges, to see which way breaks a rule. A maze it can solve without guessing has one solution, and is kept; '
        + 'the rest, about one in twenty, are drawn again. The solver was checked against every path on small grids. '
        + 'The board view only turns the pointer into steps between cells, or between the grid\'s corners, and the '
        + 'puzzle model keeps each stroke as one action to undo.',
    ].join('\n\n'),
    howToPlay: {
        intro: HOW_TO_PLAY.rules.join(' '),
        controls: [
            { action: 'Choose a day', inputs: ['click', 'tap'], note: 'Pick a level from the tabs first' },
            ...HOW_TO_PLAY.controls,
            { action: 'How to play', inputs: [{ button: 'How to play' }], note: 'Shows the rules again, and Show me walks you through drawing' },
        ],
        notes: HOW_TO_PLAY.notes,
    },
};

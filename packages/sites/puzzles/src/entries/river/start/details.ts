import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** River's long text, for its info panel and the search. The page loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A logic puzzle in which you draw a river winding through a valley, from a spring on its left edge to the sea on '
        + 'its bottom edge, a kind of puzzle known elsewhere as Train Tracks. The river runs from cell to cell, straight on '
        + 'or round a corner, and never crosses itself or splits. The numbers along the top and down the right say how many '
        + 'cells of each row and column it runs through, and that is all you need to find its one way to the sea.',
        'There is a new valley every day at each of four levels: Easy on a 6 by 6 grid, Medium and Hard on 8 by 8, and '
        + 'Expert on 10 by 10. Each puzzle prints a few pieces of river and bushes on dry land, as few as it needs, so that '
        + 'it can always be solved by looking, without guessing. Everyone gets the same puzzles on the same day, and '
        + 'every day back to the start of 2026 can still be played. Each puzzle you solve is ticked off on the calendar, '
        + 'and one you leave half done is kept just as you left it.',
    ].join('\n\n'),
    implementation: [
        'Each puzzle is made the moment it opens, from a seed worked out from its date and level, so every player\'s game '
        + 'makes the same one without asking a server. The maker works backwards from the answer. It draws a river by a '
        + 'loop-erased random walk: it walks at random from the spring until it reaches the sea, and rubs out each loop as '
        + 'it closes. Then it adds bends, taking a straight step of the river out through the two cells beside it and back, '
        + 'until the river fills about half the valley. It reads the numbers off the rows and columns.',
        'Then a solver works the puzzle as a person would, by looking. It uses the rule that a river cell has two river sides, and an '
        + 'end one. It fills lines whose numbers are met or need every cell left, rules out dead ends, blocks any side that '
        + 'would close a loop or finish the river too soon, and counts how many times the river must cross the line '
        + 'between two columns, odd or even. It never supposes and follows. Wherever it gets stuck, the maker prints the '
        + 'answer for one cell and goes on, then removes each printed cell again, keeping only those the solver can\'t do '
        + 'without. A puzzle the solver finishes can only have one answer, and a separate search checks that it does.',
        'The river is drawn with Pixi graphics, a curve through each cell it bends in, worked out from the marks whenever '
        + 'they change. The glints on the water, and the light that runs down the river as the puzzle is solved, are '
        + 'presentation state: the board view moves them on in its update step.',
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

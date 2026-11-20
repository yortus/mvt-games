import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Boats' long text, for its info panel and the search. The page loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A logic puzzle in which you moor a fleet of boats in a harbour, a kind of puzzle known elsewhere as Battleship '
        + 'Solitaire. Each boat is a straight line of cells, and boats never touch, not even diagonally, so each one has '
        + 'room to swing with the tide. The numbers along the top and down the left say how many cells of each row and '
        + 'column hold part of a boat. That, and the fleet listed under the harbour, is all you need.',
        'There is a new harbour every day at each of four levels: Easy on a 6 by 6 grid, Medium on 8 by 8, and Hard and '
        + 'Expert on 10 by 10 with the classic fleet of ten boats. Each puzzle prints a few cells of water and pieces of '
        + 'boats, as few as it needs, so that it can always be solved by looking, without guessing. Everyone gets the '
        + 'same puzzles on the same day, and every day back to the start of 2026 can still be played. Each puzzle you '
        + 'solve is ticked off on the calendar, and one you leave half done is kept just as you left it.',
    ].join('\n\n'),
    implementation: [
        'Each puzzle is made the moment it opens, from a seed worked out from its date and level, so every player\'s game '
        + 'makes the same one without asking a server. The maker works backwards from the answer. It places the fleet at '
        + 'random, longest boat first, so that boats never touch, then reads the numbers off the rows and columns.',
        'Then a solver works the puzzle as a person would, by looking. It turns the cells diagonally beside each boat to '
        + 'water, fills lines whose numbers are met or need every cell left, caps boats as long as the longest still to '
        + 'find, grows boats that must be longer, and lists every place each boat still to find could go. It never '
        + 'supposes a boat and follows it. Wherever it gets stuck, the maker prints the answer for one cell, water or a '
        + 'piece of a boat, and goes on. Then it removes each printed cell again, keeping only those the solver can\'t do '
        + 'without. A puzzle the solver finishes can only have one answer, and a separate search checks that it does.',
        'The harbour is drawn with Pixi graphics, a hull for each straight run of boat cells, worked out from the marks '
        + 'whenever they change. The glints on the water are presentation state: the board view moves them on in its '
        + 'update step, and sets how bright each one is in its refresh step.',
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

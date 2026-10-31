import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Sudoku's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A new Sudoku puzzle every day, at each of five levels, from Easiest to Hardest. Everyone gets the same puzzles on '
        + 'the same day. Today\'s are ready at your midnight, and every day back to the start of 2026 can still be played, '
        + 'so there is a whole calendar to work through. Each puzzle you solve is ticked off on the calendar, and one '
        + 'you leave half done is kept just as you left it.',
        'Your notes can reach across cells. Tap a cell and pencil in the digits that could go there. Or drag across two '
        + 'or three cells in a row, a column or a box, and note the digits they hold between them: a 2 and an 8 that '
        + 'must go in two neighbouring cells, in either order, show as one "2·8" across both. When you know a cell\'s '
        + 'number, double-tap the cell to fill it in, and its notes are cleared away. A digit that breaks a rule shows '
        + 'in red. The first time you play, a short tutorial on a practice puzzle shows you how, with an arrow that does each step first.',
    ].join('\n\n'),
    implementation: [
        'The puzzles are made by Sudoku Digger, another entry here, which shows the making step by step. This game asks '
        + 'it for a puzzle at once, out of sight, seeded from the day\'s number and the level. So every player\'s game '
        + 'makes the same puzzle without asking a server. The model reads no clock: the starter gives it today\'s '
        + 'number, and a store over the browser\'s local storage.',
        'Every note is kept in the model, so it can be saved and undone like any other move: pencil marks as a set of '
        + 'digits for each cell, and group notes as a list that is replaced whenever it changes. The tutorial is a '
        + 'small model of its own, which watches the practice puzzle and moves on a step as the player does what it '
        + 'asks. It works out what to show next on the puzzle as it stands, such as two cells that share two possible '
        + 'digits, and an arrow drawn in the view acts it out. The board view only turns the pointer into selections. It tells a tap from a drag, and a double tap '
        + 'from two taps, by the time it counts in its update step.',
    ].join('\n\n'),
    howToPlay: {
        intro: 'Fill every cell so that each row, column and 3 by 3 box holds the digits 1 to 9 once each.',
        controls: [
            { action: 'Choose a day', inputs: ['click', 'tap'], note: 'Pick a level from the tabs first' },
            { action: 'Pencil marks', inputs: ['tap'], note: 'Tap a cell, then the digits on the keypad' },
            { action: 'Link cells', inputs: ['drag'], note: 'Drag across cells, then the digits they hold between them' },
            {
                action: 'Fill in a cell',
                inputs: ['double-tap'],
                note: 'Double-tap the cell and choose its number, or double-tap a digit\'s key with the cell selected',
            },
            { action: 'Undo', inputs: [{ button: 'Undo' }] },
            { action: 'Show me how', inputs: [{ button: 'How to make notes' }], note: 'Plays the tutorial again' },
        ],
        notes: [
            'Tap a linked note\'s label to select its cells again. Tap one of several cells selected to leave it out.',
            'Your progress on every puzzle is kept in this browser.',
        ],
    },
};

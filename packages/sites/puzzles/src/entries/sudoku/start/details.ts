import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Sudoku's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A new Sudoku puzzle every day, at each of four levels, from Easy to Expert. Everyone gets the same puzzles on '
        + 'the same day. Today\'s are ready at your midnight, and every day back to the start of 2026 can still be played, '
        + 'so there is a whole calendar to work through. Each puzzle you solve is ticked off on the calendar, and one '
        + 'you leave half done is kept just as you left it.',
        'Your notes can reach across cells. Tap a cell and pencil in the digits that could go there. Or drag across two '
        + 'or three cells in a row, a column or a box, and note the digits they hold between them: a 2 and an 8 that '
        + 'must go in two neighbouring cells, in either order, show as one "2·8" across both. When you know a cell\'s '
        + 'number, tap the cell, then press and hold its digit on the keypad to fill it in, and its notes are cleared away. A '
        + 'digit that breaks a rule shows in red. As the game first opens, a card says how to play, and Show me walks '
        + 'you through making notes on a practice puzzle, with an arrow that does each step first.',
    ].join('\n\n'),
    implementation: [
        'The puzzles are made by Sudoku Digger, another entry here, which shows the making step by step. This game asks '
        + 'it for a puzzle at once, out of sight, seeded from the day\'s number and the level. So every player\'s game '
        + 'makes the same puzzle without asking a server. The model reads no clock: the starter gives it today\'s '
        + 'number, and a store over the browser\'s local storage.',
        'Every note is kept in the model, so it can be saved and undone like any other move: pencil marks as a set of '
        + 'digits for each cell, and group notes as a list that is replaced whenever it changes. The walkthrough is '
        + 'the one every puzzle here shares: a small model that watches the practice puzzle and moves on a step as '
        + 'the player does what it asks. Sudoku gives it the steps as data, each with a way to work out what to show '
        + 'on the puzzle as it stands, such as two cells that share two possible digits, and an arrow drawn in the '
        + 'view acts it out. The board view only turns the pointer into selections, and tells a tap from a drag. The '
        + 'keypad tells a tap from a hold by the time it counts in its update step, as a key is held down.',
    ].join('\n\n'),
    howToPlay: {
        intro: HOW_TO_PLAY.rules.join(' '),
        controls: [
            { action: 'Choose a day', inputs: ['click', 'tap'], note: 'Pick a level from the tabs first' },
            ...HOW_TO_PLAY.controls,
            { action: 'How to play', inputs: [{ button: 'How to play' }], note: 'Shows the rules again, and Show me walks you through making notes' },
        ],
        notes: HOW_TO_PLAY.notes,
    },
};

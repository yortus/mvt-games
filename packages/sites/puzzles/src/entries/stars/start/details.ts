import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Stars' long text, for its info panel and the search. The page loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A logic puzzle in which you place stars that never touch, a kind of puzzle known elsewhere as Star Battle. The '
        + 'grid is cut into as many regions as it has rows, and every row, every column and every region holds exactly two '
        + 'stars. No two stars touch, not even at a corner, and that one rule does most of the work: each star you place '
        + 'rules out the eight cells round it.',
        'There is a new puzzle every day at each level, all on a 9 by 9 grid for now: Easy, which a little looking ahead '
        + 'solves, and Medium, which takes more. Everyone gets the same puzzles on the same day, and every day back to the '
        + 'start of 2026 can still be played. Each puzzle you solve is ticked off on the calendar, and one you leave half '
        + 'done is kept just as you left it.',
    ].join('\n\n'),
    implementation: [
        'Each puzzle is made the moment it opens, from a seed worked out from its date and level, so every player\'s game '
        + 'makes the same one without asking a server. The maker works backwards from the answer. It lays out the stars '
        + 'first, two in every row and column, then grows half a region round each star and pairs the halves up, so each '
        + 'region holds two. While a solver finds another answer, the maker moves a cell that holds a star in that answer '
        + 'into the region beside it, which breaks that answer and keeps its own.',
        'A second solver then works the puzzle as a person would: it rules out the cells round each star, fills lines that '
        + 'have only as many cells left as stars they need, counts regions inside bands of rows, and looks ahead, asking '
        + 'whether a star here would leave some line without room. A puzzle it can solve without guessing is kept, and '
        + 'graded by how far it had to look. The board view only turns the pointer into taps and drags over cells.',
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

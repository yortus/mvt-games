import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Boats' long text, for its info panel and the search. The page loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'Boats is a logic puzzle in which you moor a fleet of boats in a harbour. It\'s a kind of puzzle known elsewhere '
        + 'as Battleship Solitaire. Each boat is a straight line of cells. Boats never touch, not even diagonally, so each '
        + 'one has room to swing with the tide. The numbers along the top and down the left say how many cells of each '
        + 'row and column hold part of a boat. That, and the fleet listed under the harbour, is all you need.',
        'There\'s a new harbour every day at each of four levels. Easy is on a 6 by 6 grid, and Medium on 8 by 8. Hard and '
        + 'Expert are on 10 by 10, with the classic fleet of ten boats. Each puzzle starts with a few cells filled in, '
        + 'water or pieces of boats. Only as many are filled in as you need to solve it by looking, without guessing. '
        + 'Everyone gets the same puzzles on the same day, and you can still play every day back to the start of 2026. '
        + 'Each puzzle you solve is ticked off on the calendar, and one you leave half done is kept just as you left it.',
    ].join('\n\n'),
    implementation: [
        'Each puzzle is made the moment it opens. The maker starts from a seed, a number worked out from the puzzle\'s '
        + 'date and level, so every player\'s browser makes the same puzzle without a server. The maker works backwards '
        + 'from the answer. It places the fleet at random, longest boat first, so that boats never touch. Then it counts '
        + 'the boat cells in each row and column for the numbers.',
        'Next, a solver works through the puzzle as a person would, by looking. It turns the cells diagonally beside each '
        + 'boat to water. It fills in a row or column whose number is met, or that needs every cell left. A boat as long '
        + 'as the longest still to find can\'t grow, so it puts water at its ends. A boat that must be longer grows. The '
        + 'solver\'s hardest step lists every place where each boat still to find could go. It never guesses a boat to see where that leads. Wherever the '
        + 'solver gets stuck, the maker fills in one cell from the answer, as water or a piece of a boat, and the solver '
        + 'goes on. Then the maker removes each filled-in cell in turn, and puts it back only if the solver can\'t finish '
        + 'without it. A puzzle that the solver finishes has only one answer, since every step was forced. The tests check '
        + 'that with a separate search.',
        'The harbour is drawn with Pixi graphics. Each straight run of boat cells is one hull, worked out again from the '
        + 'marks whenever they change. The glints on the water are presentation state, which the model doesn\'t track. The '
        + 'board view moves them on in its update step, and sets how bright each one is in its refresh step.',
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

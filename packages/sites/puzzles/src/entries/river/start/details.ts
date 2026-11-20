import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** River's long text, for its info panel and the search. The page loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'River is a logic puzzle. You draw a river winding through a valley, from a spring on its left edge to the sea on '
        + 'its bottom edge. Elsewhere, this kind of puzzle is known as Train Tracks. The river runs from cell to cell, '
        + 'straight on or round a corner. It never crosses itself, splits or runs in a circle. The numbers along the top '
        + 'and down the right say how many cells of each row and column it runs through. With the pieces printed on the '
        + 'valley, they\'re all you need to find the river\'s one way to the sea.',
        'There\'s a new valley every day at each of four levels. Easy is on a 6 by 6 grid, Medium and Hard are on 8 by 8, '
        + 'and Expert is on 10 by 10. Each valley has a few pieces of river and a few bushes printed on it. Only as many '
        + 'are printed as the puzzle needs, so you can always solve it without guessing. Everyone gets the same puzzles '
        + 'on the same day, and you can still play every day back to the start of 2026. Each puzzle you solve is ticked '
        + 'off on the calendar. If you leave one half done, it\'s kept just as you left it.',
    ].join('\n\n'),
    implementation: [
        'Each puzzle is made the moment it opens, from a seed worked out from its date and level. A seed is the number '
        + 'that a random number generator starts from, and the same seed always produces the same numbers. So every '
        + 'player\'s game makes the same puzzle, without asking a server. The code that makes it, the maker, works '
        + 'backwards from the answer. First it draws a river by a loop-erased random walk. It walks at random from the '
        + 'spring until it reaches the sea, and rubs out each loop as it closes. Then it adds bends until the river fills '
        + 'about half the valley. For each bend, it picks a step of the river from one cell to the next. If the two cells '
        + 'beside that step, on one side, are both free, it routes the river out through them and back. Last, it reads '
        + 'the numbers off the rows and columns.',
        'Next, a solver works the puzzle as a person would, by looking at the valley as it stands. It starts from the '
        + 'rules. The river runs into each of its cells and out again, so a river cell has two river sides. The cells at '
        + 'the river\'s two ends have one each, besides the side where the river runs off the valley. When a line\'s '
        + 'number is met, the rest of the line is dry. When a line needs every open cell it has left, they\'re all river. '
        + 'A cell with fewer than two open sides is a dead end, so it\'s dry. For Hard and Expert, the solver also blocks '
        + 'any side that would close a loop, or finish the river before every number is met. For Expert, it also counts '
        + 'how many times the river must cross the line between two columns, or two rows. That count is odd if the '
        + 'spring and the sea are on opposite sides of the line, and even if they\'re on the same side. The solver never '
        + 'guesses a cell and follows where the guess leads.',
        'Wherever the solver gets stuck, the maker prints the answer for one open cell, picked at random, and goes on. '
        + 'Then it removes each printed cell again, and keeps only those that the solver can\'t do without. It finds the '
        + 'printed cells three times over, and keeps the set with the fewest. A puzzle that the solver finishes has only '
        + 'one answer, since every step it took was forced. A separate search counts the answers to check that, but it '
        + 'runs only in the game\'s tests, not when a puzzle is made.',
        'The river is drawn with Pixi graphics. It curves through each cell that it bends in, and it\'s drawn again from '
        + 'the marks whenever they change. The glints on the water, and the light that runs down the river as the puzzle '
        + 'is solved, are presentation state. That\'s state that only the views keep, for how the game looks, and the '
        + 'model doesn\'t track it. The board\'s views move it on in their update steps.',
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

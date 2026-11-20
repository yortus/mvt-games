import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play Minotaur, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'You\'re lost in a labyrinth on Crete, and you can\'t see its walls. To escape, lay Ariadne\'s thread from Α to Ω, '
        + 'through every cell once. The thread never branches, crosses itself or loops.',
        'Every side of a cell that the thread doesn\'t cross is a wall. The numbers are the lengths of wall along each line, '
        + 'in order, top to bottom and left to right, with at least one gap between them.',
        'At Hard and Expert, a few lines hide their whole clue, and show a single ? in its place. You can still work out '
        + 'those lines from the cells and walls around them.',
    ],
    controls: [
        { action: 'Lay the thread', inputs: ['drag'], note: 'Start in the middle of a cell, and drag through the cells' },
        { action: 'Draw walls', inputs: ['drag'], note: 'Start at a corner, and drag along the lines' },
        { action: 'Rub out', inputs: ['drag'], note: 'Drag over a wall, or the thread, again' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'A clue fades once the walls on its line match it, and turns red if they can\'t. A cell is hatched in red if its marks '
        + 'break a rule.',
        'Your progress on every maze is kept in this browser.',
    ],
};

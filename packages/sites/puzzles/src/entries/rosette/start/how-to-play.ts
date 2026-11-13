import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play Rosette, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'A window has come in with its glass all jumbled. Swap the pieces back until the colours run smoothly from one side '
        + 'to the other.',
        'A piece only swaps with another of the same shape.',
        'The pieces with heavier lead, round the frame, are locked in place. Work in from them, as you would with a jigsaw. '
        + 'A piece with a white ring still needs placing: put it in its place next to a locked piece, and it locks too.',
    ],
    controls: [
        { action: 'Swap two pieces', inputs: ['drag'], note: 'Drag a piece onto another of its shape, and let go' },
        { action: 'Swap two pieces', inputs: ['click', 'tap'], note: 'Tap one piece, then another of its shape. Tap it again to put it down' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last swap' },
    ],
    notes: [
        'A piece you place correctly only locks if it is touching locked pieces.',
        'When the window is mended, you see how many swaps you took, and the fewest it could be done in.',
        'Your progress on every window is kept in this browser.',
    ],
};

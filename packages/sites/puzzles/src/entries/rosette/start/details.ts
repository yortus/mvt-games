import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Rosette's long text, for its info panel and the search. The page loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A colour puzzle in a leaded window. Its glass has come in jumbled, and you mend it by swapping pieces of the same '
        + 'shape until the colours run smoothly. The pieces round the frame are locked, so you work in from them, as you '
        + 'would with a jigsaw.',
        'There is a new window every day at each of four levels, from Easy, with bold colours, to Expert, where neighbours '
        + 'are only just different. Everyone gets the same windows on the same day, and every day back to the start of 2026 '
        + 'can still be played.',
    ].join('\n\n'),
    implementation: [
        'Each window is made the moment it opens, from a seed worked out from its date and level. Its tiles are laid by de '
        + 'Bruijn\'s multigrid method, at 5, 7, 8, 10 or 12-fold symmetry: draw several sets of parallel lines, each turned a '
        + 'little from the last, and put a tile wherever two lines cross. Two tiles are neighbours when their crossings come '
        + 'one after the other along a line. The frame is sized to hold the level\'s glass, and cuts the tiles it crosses, '
        + 'one straight side at a time. A sliver too small to see or tap joins the cut piece beside it.',
        'The gradient is made in OKLCH, a colour space in which equal steps look equally different. The hue sweeps along one '
        + 'axis and lightness rises along the other, leaning warm in the light and cool in the shadows, with each colour as '
        + 'vivid as the screen can show. A level sets how alike the two most alike pieces may look, and the gradient is '
        + 'widened or narrowed until it fits. A piece the frame cuts deeply is a shape of its own, so it is locked, and the '
        + 'locked pieces hold most of the gradient\'s rim. A piece the frame only trims keeps its shape, as though the frame '
        + 'hid a corner of it. It is jumbled with the rest, each among the tiles of its own shape, so every piece can be '
        + 'swapped home.',
    ].join('\n\n'),
    howToPlay: {
        intro: HOW_TO_PLAY.rules.join(' '),
        controls: [
            { action: 'Choose a day', inputs: ['click', 'tap'], note: 'Pick a level from the tabs first' },
            ...HOW_TO_PLAY.controls,
            { action: 'How to play', inputs: [{ button: 'How to play' }], note: 'Shows the rules again, and Show me walks you through swapping' },
        ],
        notes: HOW_TO_PLAY.notes,
    },
};

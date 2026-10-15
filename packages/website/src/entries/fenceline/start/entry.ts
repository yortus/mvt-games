import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fenceline, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'fenceline',
    name: 'Fenceline',
    summary: 'String wire across a wild meadow to fence it off, penning sheep and starving the dust devils.',
    description: [
        'A territory game. You are a farmhand fencing off a wild meadow. String wire across it from fence to '
        + 'fence, and the part with no dust devil in it turns to pasture. Pen the sheep as you go, and corner a '
        + 'dust devil in a small paddock to blow it out.',
        'The meadow is a grid model of cells, with fences along the lines between them. Tying off a wire runs '
        + 'one flood fill, and the views redraw the pasture and fences only as that happens.',
    ].join('\n\n'),
    instructions: [
        'Fence off the round\'s share of',
        'the meadow to clear it.',
        '',
        'Move: arrows / WASD / joystick',
        'Walk the fences. Push off one into',
        'the meadow to string wire, and',
        'reach another fence to tie it off.',
        '',
        'Keep your wire clear of dust',
        'devils, and keep moving: wire left',
        'standing goes slack and snaps.',
        'Beetles on the fences bite.',
        'Enter restarts.',
        '',
        'Touch: swipe to steer, tap to stop.',
    ].join('\n'),
    tags: { kind: 'game', era: '1980s', genres: ['action', 'puzzle'] },
    screenWidth: 496,
    screenHeight: 368,
    inspiredBy: { title: 'Qix', maker: 'Taito', year: 1981 },
    thumbnail,
    // The colour of its pasture
    cardColor: 'mint',
    load: async () => (await import('./load')).load(),
};

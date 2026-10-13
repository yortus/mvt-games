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
        'Walk along the fences.',
        '',
        'Hold Space (String) and push off a',
        'fence to string wire across the',
        'meadow. Reach another fence to tie',
        'it off: every part with no dust',
        'devil in it becomes pasture.',
        '',
        'Ponds and rocks cannot be crossed,',
        'but a wire can be tied to them.',
        '',
        'Sheep fenced into pasture are',
        'penned, for a bonus. Any left out',
        'when the round ends are lost.',
        '',
        'A dust devil feeds on open meadow:',
        'fence it into less and it shrinks.',
        'When it sputters, it is one cut',
        'from blowing itself out.',
        '',
        'A dust devil touching your wire,',
        'or a beetle on the fence reaching',
        'you, costs a life. Stand still on',
        'a wire and it goes slack from the',
        'post: if the slack reaches you,',
        'it snaps. You have 3 lives.',
        'Enter restarts.',
        '',
        'On a touch screen, swipe to steer:',
        'the farmhand keeps going until you',
        'swipe again, or tap to stop.',
        'Swiping off a fence strings wire.',
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

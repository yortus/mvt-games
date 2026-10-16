import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The falling-sand demo, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'falling-sand',
    name: 'Falling Sand',
    summary: 'Pour sand and water into a tank, then flip it: a sprite for every grain, to push the game loop.',
    description: [
        'An aquarium of sand, water and walls, and a stress test for the MVT game loop. Every grain is its own '
        + 'item in the model and its own sprite in the view, so the refresh pass touches every grain in the tank '
        + 'every frame, while the simulation only touches the grains that are moving.',
        'Pour until the frame timings climb, then flip the tank to set everything moving at once. Switches below '
        + 'the tank restart it with other implementations of the model and the view, to compare their cost.',
    ].join('\n\n'),
    techniques: [
        'One sprite per grain, projected by an index-addressed <List>',
        'Sleeping grains: simulation cost follows moving grains, refresh cost follows all grains',
        'Fixed-timestep cellular automaton, frame-rate independent and seeded',
        'Pointer input relayed to the model in domain units (cells)',
        'A domain-owned flip: the model turns the tank, the view just follows its angle',
        'Two implementations of one model interface: a record per grain, or a typed array per field',
        'Two views of the same grains: a sprite per grain, or a pixel per cell',
    ],
    tags: { kind: 'demo', genres: ['simulation'] },
    screenWidth: 480,
    screenHeight: 838,
    thumbnail,
    // The colour of its sand
    cardColor: 'apricot',
    // The tank, without its controls
    thumbnailCrop: { x: 0, y: 0, width: 480, height: 560 },
    load: async () => (await import('./load')).load(),
};

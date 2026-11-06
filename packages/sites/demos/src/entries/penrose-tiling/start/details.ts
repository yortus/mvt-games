import type { EntryDetails } from '@mvtjs/site-kit/entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Penrose Tiling's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A Penrose tiling covers the plane with just two shapes of tile, in a pattern that never repeats. Slide the '
        + 'symmetry to see its relatives: below 5 they repeat, as cubes and squares, and from 5 up they never do. Slide '
        + 'the shift to melt tiles into new arrangements. Slide Grids up, and each tile draws back to a crossing of two '
        + 'lines, which shows why: below 5, the lines cross in a plain lattice.',
    implementation: 'The tiles come from de Bruijn\'s multigrid method: draw grids of parallel lines, each turned a little from '
        + 'the last. Every crossing of two lines becomes a tile, and counting the lines on each side of it says where '
        + 'the tile goes. There are two models, the tiling and a scope looking at it, like Fractalscope\'s. Neither knows '
        + 'about the other: their parent tells the tiling where the scope is looking. A tile can\'t move part of the way, '
        + 'so as the grids shift, the tiling lays two exact sets of tiles a small step apart, and the view dissolves one '
        + 'picture into the other.',
    howToPlay: {
        intro: 'Make a tiling of your own with the sliders and the buttons in the panel.',
        controls: [
            { action: 'Move', inputs: ['arrows', 'wasd', 'drag'] },
            { action: 'Zoom', inputs: ['wheel', 'double-tap'], touchInputs: ['pinch'] },
            { action: 'Drift', inputs: ['space'], touchInputs: [{ button: 'Start drift' }] },
        ],
        notes: [
            'Twist two fingers to turn the tiling, or press Q and E.',
            'Keys for the rest: + and - zoom, [ and ] change the symmetry, , and . shift, C steps through the palettes, '
            + 'V through what decides the colours, X picks a surprise, R resets the view, H hides the panel, and P saves a picture.',
            'G shows the grids, where a tap picks out a tile\'s two lines.',
        ],
    },
    techniques: [
        'De Bruijn\'s multigrid method, for the Penrose tiling and its relatives of any symmetry',
        'A specimen and an instrument as two models, which meet only in their parent',
        'How the tiling looks as a view model, which the canvas and the panel share',
        'Two exact tilings dissolving into each other, since a tile can only be in one place or another',
        'Tiles sorted by colour and filled one by one on a 2D canvas',
        'A tile set that keeps how each tile was made, so one set of numbers draws both the tiles and the grids',
    ],
};

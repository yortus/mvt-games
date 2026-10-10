import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fractalscope, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'fractalscope',
    name: 'Fractalscope',
    summary: 'Zoom into eight fractals, from the Mandelbrot set to the Burning Ship, with a pinch or the mouse wheel.',
    description: [
        'An explorer of eight fractals: the Mandelbrot set, the Burning Ship, the Tricorn, a cubic Multibrot, the '
        + 'Celtic Mandelbrot, two Julia sets and the Phoenix. Drag to travel, and pinch, scroll or double tap to '
        + 'close in. The panel has a map of the whole fractal with a mark where you are, your coordinates and '
        + 'zoom, a choice of palettes, and a button that saves what you see.',
        'The model computes the image a little each frame, coarse blocks first, then each pass halving them, '
        + 'so a whole picture is there at once and sharpens in place. A gesture moves the region at once and '
        + 'leaves the image behind. The view stretches the old picture to fit, blocky as you go. Once the '
        + 'gesture ends, the model computes the new one, starting from the stretched picture so it never jumps.',
    ].join('\n\n'),
    instructions: 'Choose a fractal from the panel. Drag to move. Pinch, scroll the wheel or double tap to zoom. '
        + 'Choose a palette, save a photo once the view is sharp, or reset to the whole fractal.',
    techniques: [
        'Progressive computation in the model, on a budget of iterations per frame',
        'A gesture moves the model\'s region at once; the view stretches the last image until the new one arrives',
        'The new image starts from the old one, moved to fit, so it never gets blockier as it sharpens',
        'Only the rows that changed are coloured each frame',
        'Pinch, drag, wheel and double tap turned into moves in the complex plane',
        'One renderer, the DOM: 2D canvases and an HTML panel',
    ],
    tags: { kind: 'demo', genres: ['ui', 'demoscene'] },
    // It fills whatever it is given; this is the shape of a typical one.
    screenWidth: 1280,
    screenHeight: 800,
    thumbnail,
    // The colour of its ember palette
    cardColor: 'apricot',
    // A square of the image around the set, left of the panel
    thumbnailCrop: { x: 40, y: 0, width: 800, height: 800 },
    load: async () => (await import('./load')).load(),
};

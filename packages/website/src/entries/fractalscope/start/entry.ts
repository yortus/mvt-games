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
        'The model is the scope itself, like a microscope: the fractal under it, the point it is centred on, and '
        + 'how strongly it magnifies. Your gestures work its controls, and its setting changes at once. The '
        + 'picture is the view\'s own presentation state, like a photograph taken at the scope\'s last setting. '
        + 'It follows a step behind, computed a little each frame, coarse blocks first and sharpening in place. '
        + 'While you move, the view stretches the old picture to fit, blocky as you go. Once you stop, the '
        + 'picture is taken again, starting from the stretched one so it never jumps.',
    ].join('\n\n'),
    instructions: 'Choose a fractal from the panel. Drag to move. Pinch, scroll the wheel or double tap to zoom. '
        + 'Choose a palette, save a photo once the picture is sharp, or reset to the whole fractal.',
    techniques: [
        'The model as an instrument: its setting, its controls, and a query for how fast a point escapes',
        'Gestures in the view, the scope\'s own controls in the model, and the bindings translating between them',
        'The picture as a view model, computed a little each frame on a budget of iterations',
        'Every control changes the scope at once; the picture follows a step behind, stretched until it catches up',
        'The new image starts from the old one, moved to fit, so it never gets blockier as it sharpens',
        'Only the rows that changed are coloured each frame',
        'Pinch, drag, wheel and double tap turned into moves in the complex plane',
        'One renderer, the DOM: 2D canvases and an HTML panel',
    ],
    tags: { kind: 'demo', genres: ['ui'] },
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

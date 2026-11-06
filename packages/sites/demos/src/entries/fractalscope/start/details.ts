import type { EntryDetails } from '@mvtjs/site-kit/entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Fractalscope's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'An explorer of eight fractals: the Mandelbrot set, the Burning Ship, the Circle lace, the Batik fold, the '
        + 'Newton pinwheel, two Julia sets and the Phoenix. Drag to travel, and pinch, scroll or double tap to '
        + 'close in. The panel has a map of the whole fractal with a mark where you are, your coordinates and '
        + 'zoom, a choice of palettes, and a button that saves what you see.',
    implementation: 'The model is the scope itself, like a microscope: the fractal under it, the point it is centred on, and '
        + 'how strongly it magnifies. Your gestures work its controls, and its setting changes at once. The '
        + 'picture is the view\'s own presentation state, like a photograph taken at the scope\'s last setting. '
        + 'It follows a step behind, computed a little each frame, coarse blocks first and sharpening in place. '
        + 'While you move, the view stretches the old picture to fit, blocky as you go. Once you stop, the '
        + 'picture is taken again, starting from the stretched one so it never jumps.',
    howToPlay: {
        intro: 'Choose a fractal from the panel.',
        controls: [
            { action: 'Move', inputs: ['arrows', 'wasd', 'drag'] },
            { action: 'Zoom', inputs: ['wheel', 'double-tap'], touchInputs: ['pinch'] },
        ],
        notes: [
            'Choose a palette, save a photo once the picture is sharp, or reset to the whole fractal.',
            'Keys for the rest: + and - zoom, [ and ] change the fractal, C steps through the palettes, X picks a surprise, '
            + 'R resets the view, H hides the panel, and P saves a photo.',
        ],
    },
    techniques: [
        'The model as an instrument: its setting, its controls, and a query for how fast a point escapes',
        'Gestures in the view, the scope\'s own controls in the model, and the bindings translating between them',
        'The picture as a view model, computed a little each frame on a budget of iterations',
        'Every gesture changes the scope at once; the picture follows a step behind, stretched until it catches up',
        'Held keys as the scope\'s own controls, moving it on with each update, with the picture retaken as it goes',
        'The new image starts from the old one, moved to fit, so it never gets blockier as it sharpens',
        'Only the rows that changed are coloured each frame',
        'Pinch, drag, wheel and double tap turned into moves in the complex plane',
        'One renderer, the DOM: 2D canvases and an HTML panel',
    ],
};

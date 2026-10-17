import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The flock in 3D's long text, for its info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'The boids demo\'s flock model, unchanged, drawn with three.js through the same JSX runtime as the Pixi '
        + 'games. The settings panel is HTML, through that runtime too, following the same model: two views of '
        + 'one model, on two renderers.',
        'Each frame runs the MVT way: the model updates, then `updateView` and `refreshView` call both views\' '
        + 'methods, then three.js renders.',
    ].join('\n\n'),
    instructions: 'Click the ground to add boids, or a boid to take some away.',
    techniques: [
        'One model, two renderers: three.js and the DOM',
        'The three.js JSX runtime',
        'Pointer picking in a three.js scene',
        'A camera orbit as presentation state, paused with the views',
    ],
};

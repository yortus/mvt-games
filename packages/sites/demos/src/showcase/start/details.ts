import type { EntryDetails } from '@mvtjs/site-kit/entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The Gallery's long text, for its info panel, which the nav's (i) opens while the gallery shows. The page loads it as the panel opens. */
export const details: EntryDetails = {
    description: 'A bright, quiet gallery of three long corridors, with every demo on the site hung on its walls as a '
        + 'painting. The paintings near you come alive as you walk by. Step up to one to run its demo, then step back '
        + 'and wander on. There are benches down the middle, and plants in pots.',
    howToPlay: {
        intro: 'Walk round the gallery, face a painting, and step up to view it.',
        controls: [
            { action: 'Walk', inputs: [{ control: 'up-down' }], touchInputs: ['joystick'] },
            { action: 'Step sideways', inputs: [{ control: 'left-right' }], touchInputs: ['joystick'] },
            { action: 'Look round', inputs: ['drag'], touchInputs: ['drag'] },
            { action: 'View the painting you face', inputs: [{ control: 'primary' }], touchInputs: [{ button: 'View' }] },
        ],
        notes: [
            'The demo runs as it does from its own card. Leave it, as you would any demo, to step back into the gallery.',
            'Standing at a painting, you can use its demo where it hangs. Press its buttons and drag its sliders without stepping up.',
        ],
    },
    implementation: 'The visitor is a walker, a circle on the floor that the gallery keeps out of its walls, benches and '
        + 'pots. The two paintings nearest the visitor run their demos. A Pixi demo draws on a 2D Pixi container, which a '
        + 'ContainerTexture shows on the painting. A demo that brings its own renderer runs in a box of HTML, laid over '
        + 'its painting in perspective. Stepping up to a painting glides the camera until the painting fills the '
        + 'rectangle where the page will run its demo. Then the page launches the demo over the gallery, exactly there. '
        + 'The gallery is built from the same site kit parts as the arcade\'s Arcade Hall.',
    techniques: [
        'Demos inside a gallery',
        'A 2D view on a 3D surface',
        'PixiJS 3D scenes in JSX',
        'Spotlights in PixiJS 3D',
        'A first-person camera as presentation state',
    ],
};

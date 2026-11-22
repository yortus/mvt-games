import type { EntryDetails } from '@mvtjs/site-kit/entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Chicane's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A race with missiles on a twisting circuit, with a long sweeper, a chicane, a fast back section and a '
        + 'hairpin. Drive three laps against the clock through a pack of rivals. Blast them out of your way, and dodge '
        + 'their missiles and the burning wrecks they leave.',
    howToPlay: {
        intro: 'Wait for the countdown. Your car speeds up by itself, so you steer, brake and fire for three laps.',
        controls: [
            { action: 'Steer', inputs: [{ control: 'left-right' }], touchInputs: ['joystick'] },
            { action: 'Fire a missile straight ahead', inputs: [{ control: 'primary' }], touchInputs: [{ button: 'Fire' }] },
            { action: 'Brake, then reverse', inputs: [{ control: 'down' }, { control: 'secondary' }], touchInputs: [{ button: 'Brake' }] },
            { action: 'Restart', inputs: [{ control: 'restart' }], touchInputs: ['tap'] },
        ],
        notes: [
            'A missile blows up the first car it hits. You can drive through the fireball, but not the wreck, which burns for a while.',
            'The rivals fire back when you pass them. Watch for the warning, and swerve.',
            'The grass slows you down, and the wall beyond it stops you.',
            'Your best lap stays on screen from race to race, until you leave.',
        ],
    },
    implementation: 'The car is a model on the ground, in metres, stepped at a fixed rate, so it handles the same at any '
        + 'frame rate. Its velocity lags its heading as it turns, so it slides a little, and grip wears the slide away. '
        + 'The missiles, explosions and wrecks live in fixed pools in the model, and each view keeps one set of meshes '
        + 'for each slot. The rivals look ahead in their lanes, and move across to get round a wreck. '
        + 'The scene is PixiJS 3D, written in JSX, inside a View3D on the Pixi stage, with the HUD drawn over it in 2D. The '
        + 'camera trails the car as presentation state of its own.',
    techniques: [
        'PixiJS 3D scenes in JSX',
        'Fixed pools for short-lived things',
        'A 3D scene under a 2D HUD',
        'Physics in fixed time steps',
        'A chase camera as presentation state',
        'Track geometry built from a curve',
    ],
};

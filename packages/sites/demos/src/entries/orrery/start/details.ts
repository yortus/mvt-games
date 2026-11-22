import type { EntryDetails } from '@mvtjs/site-kit/entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The orrery's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A brass orrery on a wooden plinth, with five made-up worlds round a lamp for a sun. A clockwork motor turns '
        + 'its crank, and the crank turns a train of gears that sends each world round at its own pace. One world has a '
        + 'moon on an arm of its own, and another wears a ring.\n\n'
        + 'Speed the motor up, slow it down, or run it backwards, and walk round the orrery to see the gears at work.',
    howToPlay: {
        intro: 'The slider at the bottom sets the motor\'s speed. At the middle the motor stops. Slide right to run time '
            + 'forward, and left to run it backwards.',
        controls: [
            { action: 'Turn the view', inputs: ['drag'] },
            { action: 'Zoom', inputs: ['wheel'], touchInputs: ['pinch'] },
            { action: 'Set the speed on the slider', inputs: ['drag'] },
        ],
    },
    implementation: 'Only one angle in the model moves, the crank\'s. Every other angle comes from it through the '
        + 'gears\' teeth, so the gears can never slip out of mesh. Each world\'s year is set by its pair of gears alone. '
        + 'When you change the motor\'s speed, the crank\'s speed eases to it along an exponential curve. The model moves '
        + 'the crank by the exact area under that curve, so it lands in the same place however the frames fall.\n\n'
        + 'The gears are built as meshes when the view is made, with their teeth, rims and spokes. Each arbor is a 3D '
        + 'group that turns by its angle. Each gear on it is turned once more, by a fixed phase worked out from where '
        + 'the arbors stand. That puts its teeth between the teeth of the gear that drives it. The scene is drawn by PixiJS '
        + '3D inside a View3D that sits on the Pixi stage like any other container, with the day count and the slider '
        + 'drawn over it in 2D. The model doesn\'t store where you look from, since the orrery doesn\'t depend on it. '
        + 'So where the camera stands is presentation state. The top-level view keeps it, and passes it down to the '
        + 'camera. The model counts each tooth of the crank\'s pinion that passes, and a reaction plays a click each '
        + 'time the count rises.',
    techniques: [
        'PixiJS 3D inside a Pixi stage',
        'Nested 3D groups for arbors, arms and a moon',
        'Gears that mesh, from teeth counts alone',
        'Geometry built in code',
        'Easing that lands in the same place at any frame rate',
        'An orbiting camera as presentation state',
        'A 2D slider over a 3D scene',
        'A count of passing teeth, played as clicks',
    ],
};

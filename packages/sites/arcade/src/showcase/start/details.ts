import type { EntryDetails } from '@mvtjs/site-kit/entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The Arcade Hall's long text, for its info panel, which the nav's (i) opens while the hall shows. The page loads it as the panel opens. */
export const details: EntryDetails = {
    description: 'A room full of cabinets, one for each game in the arcade. Walk up to one and play it, right there on its '
        + 'screen, then step back and try another.',
    howToPlay: {
        intro: 'Walk round the hall, face a cabinet, and step up to play it.',
        controls: [
            { action: 'Walk', inputs: [{ control: 'up-down' }], touchInputs: ['joystick'] },
            { action: 'Step sideways', inputs: [{ control: 'left-right' }], touchInputs: ['joystick'] },
            { action: 'Look round', inputs: ['drag'], touchInputs: ['drag'] },
            { action: 'Play the cabinet you face', inputs: [{ control: 'primary' }], touchInputs: [{ button: 'Play' }] },
        ],
        notes: [
            'The game plays as it does from its own card. Leave it, as you would any game, to step back into the hall.',
            'The cabinet at the far end holds the hall itself. Step up to it to go inside, and walk out through the door to come back.',
        ],
    },
    implementation: 'The cabinets near you run their games in attract mode, each on a 2D Pixi container that a ContainerTexture '
        + 'shows on the cabinet\'s screen. Their models advance with the hall\'s, and their views tick with the hall\'s scene. '
        + 'Stepping up to a cabinet launches its game through the arcade\'s page, which plays it over the hall, exactly where '
        + 'the screen is. The hall\'s own cabinet shows a second hall, standing still. Stepping inside puts you back at the '
        + 'entrance and adds one to a count of how deep you are. However deep you go, only two halls are ever built.',
    techniques: [
        'Games inside a game',
        'A 2D view on a 3D surface',
        'PixiJS 3D scenes in JSX',
        'A first-person camera as presentation state',
    ],
};

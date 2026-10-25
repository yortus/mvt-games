import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The fruit machine's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A five-reel fruit machine, played and watched through four views at once: a modern machine in Pixi, an '
        + 'old one-armed bandit in three.js, an HTML control panel, and a text terminal. Spin from any of them and '
        + 'all four follow, each in its own way.',
    implementation: 'None of the four views knows the others exist: each reads the one model every frame, and any of '
        + 'them may call its actions.',
    howToPlay: {
        intro: 'Spin from any quadrant: the Pixi button, the 3D lever, the panel\'s Spin, or `spin` in the terminal.',
        controls: [
            { action: 'Turn the 3D cabinet', inputs: ['drag'] },
        ],
    },
    techniques: [
        'One model, four projections, on three renderers',
        'One loop drives every renderer: update, then updateView and refreshView, then draw',
        'Reels as a domain model; the fruit is the views\' theme',
        'An HTML control panel and a terminal, written in HTML JSX',
    ],
};

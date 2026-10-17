import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The boids demo's long text, for its info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A bird flocking simulation using the boids algorithm developed by Craig Reynolds in 1986. The three '
        + 'classic rules - separation, alignment, and cohesion - produce emergent flocking behaviour from simple '
        + 'local interactions.',
        'All parameters are tuneable via sliders, and a frame timing panel shows what the flock costs.',
    ].join('\n\n'),
    techniques: [
        'Boids flocking algorithm',
        'Separation / Alignment / Cohesion',
        'Interactive parameter tuning',
        'Domain coordinates in metres',
        'Frame timing panel (perfmon)',
    ],
};

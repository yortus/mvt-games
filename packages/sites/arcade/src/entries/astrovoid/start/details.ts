import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Astrovoid's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A vector-style space shooter. Your ship turns, thrusts and fires; each rock you hit splits into '
        + 'smaller, faster ones, and anything that leaves one edge of the arena comes back at the other.',
    implementation: 'Every ship, rock and bullet is a model in world units, and the views turn those into pixels.',
    howToPlay: {
        intro: 'Shoot every rock to clear the wave. A hit rock splits in two, smaller and faster; the smallest are worth the most.',
        controls: [
            { action: 'Turn', inputs: ['left-right', 'a-d'], touchInputs: ['joystick'] },
            { action: 'Thrust', inputs: ['up', 'w'], touchInputs: [{ button: 'Thrust' }] },
            { action: 'Shoot', inputs: ['space'], touchNote: 'Your ship fires on its own' },
            { action: 'Restart', inputs: ['enter'], touchInputs: ['tap'] },
        ],
        notes: [
            'The arena wraps: what leaves one edge comes back at the other.',
            'A rock that hits you costs a ship; you have 3.',
        ],
    },
};

import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Astrovoid's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A vector-style space shooter. Your ship turns, thrusts and fires; each rock you hit splits into '
        + 'smaller, faster ones, and anything that leaves one edge of the arena comes back at the other.',
        'Every ship, rock and bullet is a model in world units, and the views turn those into pixels.',
    ].join('\n\n'),
    howToPlay: {
        intro: 'Shoot every rock to clear the wave. A hit rock splits in two, smaller and faster; the smallest are worth the most.',
        controls: [
            { action: 'Turn', inputs: ['left-right', 'a-d', 'joystick'] },
            { action: 'Thrust', inputs: ['up', 'w', 'joystick'] },
            { action: 'Shoot', inputs: ['space', { button: 'Fire' }] },
            { action: 'Restart', inputs: ['enter'] },
        ],
        notes: [
            'The arena wraps: what leaves one edge comes back at the other.',
            'A rock that hits you costs a ship; you have 3.',
        ],
    },
};

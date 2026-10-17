import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Astrovoid's long text, for its info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A vector-style space shooter. Your ship turns, thrusts and fires; each rock you hit splits into '
        + 'smaller, faster ones, and anything that leaves one edge of the arena comes back at the other.',
        'Every ship, rock and bullet is a model in world units, and the views turn those into pixels.',
    ].join('\n\n'),
    instructions: [
        'Shoot every rock to clear the wave.',
        'A hit rock splits in two, smaller',
        'and faster; the smallest are worth',
        'the most.',
        '',
        'Left / Right: turn',
        'Up: thrust',
        'Space (Fire): shoot',
        '(arrows / WASD / joystick)',
        '',
        'The arena wraps: what leaves one',
        'edge comes back at the other.',
        'A rock that hits you costs a ship;',
        'you have 3. Enter restarts.',
    ].join('\n'),
};

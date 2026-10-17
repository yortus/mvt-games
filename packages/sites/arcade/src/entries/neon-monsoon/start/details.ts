import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Neon Monsoon's long text, for its info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A vertical bullet hell shooter. Thousands of bullets fill the screen in patterns; hold Focus to fly '
        + 'slowly and show your hitbox, and bomb to clear the screen when it gets too much.',
        'Its models run on a fixed step with seeded random numbers, keep their bullets in typed arrays, and '
        + 'take their attack patterns as data.',
    ].join('\n\n'),
    instructions: [
        'Thread your tiny hitbox',
        'through the storm of bullets.',
        '',
        'Move: arrows / WASD / joystick',
        'Your ship fires on its own.',
        '',
        'Hold Shift (Focus) to fly',
        'slowly, show your hitbox and',
        'fire a narrow, strong shot.',
        '',
        'Space (Bomb) clears the screen',
        'and turns bullets into gems.',
        '',
        'Kill quickly to build a chain.',
        'Bullets that brush past score',
        'as grazes.',
    ].join('\n'),
};

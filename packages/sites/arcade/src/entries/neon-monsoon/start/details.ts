import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Neon Monsoon's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A vertical bullet hell shooter. Thousands of bullets fill the screen in patterns; hold Focus to fly '
        + 'slowly and show your hitbox, and bomb to clear the screen when it gets too much.',
    implementation: 'Its models run on a fixed step with seeded random numbers, keep their bullets in typed arrays, and '
        + 'take their attack patterns as data.',
    howToPlay: {
        intro: 'Thread your tiny hitbox through the storm of bullets.',
        controls: [
            { action: 'Move', inputs: ['arrows', 'wasd', 'joystick'], note: 'Your ship fires on its own' },
            { action: 'Focus', inputs: ['shift', { button: 'Focus' }], note: 'Hold to fly slowly, show your hitbox and fire a narrow, strong shot' },
            { action: 'Bomb', inputs: ['space', { button: 'Bomb' }], note: 'Clears the screen and turns bullets into gems' },
        ],
        notes: ['Kill quickly to build a chain. Bullets that brush past score as grazes.'],
    },
};

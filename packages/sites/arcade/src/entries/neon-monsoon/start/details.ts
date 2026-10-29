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
            { action: 'Focus', inputs: ['shift', { button: 'Focus' }], note: 'Hold to fly slowly, show your hitbox and fire a narrow, strong shot. With the volley charged, it also locks on' },
            { action: 'Bomb', inputs: ['space', { button: 'Bomb' }], note: 'Clears the screen and turns bullets into gems' },
        ],
        notes: [
            'Kill quickly to build a chain.',
            'Flying close to bullets charges your volley, for as long as you stay close. Once it is charged, hold Focus: its shots circle your ship as a shield, losing a shot for each bullet they stop, and lock onto the toughest enemy. Let go to fire. The more shots are left, the harder it hits.',
        ],
    },
};

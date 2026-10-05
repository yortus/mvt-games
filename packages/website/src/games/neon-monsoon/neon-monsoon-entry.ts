import type { ArcadeEntry } from '../../entries';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Neon Monsoon, as the arcade lists it. Its code loads on launch, from `neon-monsoon-starter.ts`. */
export const neonMonsoonEntry: ArcadeEntry = {
    id: 'neon-monsoon',
    name: 'Neon Monsoon',
    summary: 'Weave a tiny ship through storms of bullets, with a slow focus mode, screen-clearing bombs and a three-phase boss.',
    description: [
        'A vertical bullet hell shooter. Thousands of bullets fill the screen in patterns; hold Focus to fly '
        + 'slowly and show your hitbox, and bomb to clear the screen when it gets too much.',
        'Its models run on a fixed step with seeded random numbers, keep their bullets in typed arrays, and '
        + 'take their attack patterns as data.',
    ].join('\n\n'),
    tags: { kind: 'game', era: '1990s', genres: ['shooter', 'scrolling'] },
    screenWidth: 240,
    screenHeight: 320,
    thumbnail,
    // The colour of its neon
    cardColor: 'orchid',
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
    load: async () => (await import('./neon-monsoon-starter')).loadNeonMonsoonStarter(),
};

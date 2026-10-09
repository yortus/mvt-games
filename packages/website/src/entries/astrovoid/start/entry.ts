import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Astrovoid, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'astrovoid',
    name: 'Astrovoid',
    summary: 'Rotate, thrust and fire to break drifting rocks into ever smaller pieces, in an arena that wraps at its edges.',
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
    tags: { kind: 'game', era: '1970s', genres: ['shooter'] },
    screenWidth: 400,
    screenHeight: 430,
    inspiredBy: { title: 'Asteroids', maker: 'Atari', year: 1979 },
    thumbnail,
    load: async () => (await import('./load')).load(),
};

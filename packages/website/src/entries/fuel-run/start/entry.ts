import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fuel Run, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'fuel-run',
    name: 'Fuel Run',
    summary: 'Fly low over scrolling terrain, bombing fuel tanks to keep flying, while rockets and saucers rise to meet you.',
    description: [
        'A side-scrolling shooter. Your ship burns fuel as it flies; bomb the tanks on the ground to refill '
        + 'it, and shoot or dodge the rockets and saucers that launch at you.',
        'The largest of the games, with a model for every kind of thing in the world, tested on its own.',
    ].join('\n\n'),
    instructions: [
        'Fly over the land, keep your fuel',
        'up, and destroy the base at the',
        'end of the run.',
        '',
        'Move: arrows / WASD / joystick',
        'Space (Fire): shoot ahead',
        'Shift (Bomb): drop a bomb',
        '',
        'Your fuel burns as you fly. Bomb',
        'the fuel tanks on the ground to',
        'fill up: run dry and you crash.',
        'Shoot or dodge the rockets and',
        'saucers that rise to meet you.',
        '',
        'Hitting the ground, or anything',
        'in the air, costs a ship; you have',
        '3. Enter restarts.',
    ].join('\n'),
    tags: { kind: 'game', era: '1980s', genres: ['shooter', 'scrolling'] },
    screenWidth: 448,
    screenHeight: 248,
    inspiredBy: { title: 'Scramble', maker: 'Konami', year: 1981 },
    thumbnail,
    // The colour of its hills
    cardColor: 'mint',
    load: async () => (await import('./load')).load(),
};

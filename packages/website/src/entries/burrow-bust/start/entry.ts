import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Burrow Bust, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'burrow-bust',
    name: 'Burrow Bust',
    summary: 'Dig tunnels through the earth, and pump up the creatures that chase you along them.',
    description: [
        'A digging game. Your digger carves tunnels as it moves, creatures follow it through them, and a pump '
        + 'stops them in their tracks. Loosen a rock from below and it falls on whatever is underneath.',
        'The field is a grid model that the digger changes as it goes, and every view reads it in rows and columns.',
    ].join('\n\n'),
    instructions: [
        'Clear every creature from the',
        'field to finish the level.',
        '',
        'Move: arrows / WASD / joystick',
        'You dig as you go.',
        '',
        'Space (Pump) shoots your pump the',
        'way you face. Hit a creature, then',
        'press again and again to blow it',
        'up until it pops. Deeper earth',
        'scores more; a salamander pumped',
        'from the side scores double.',
        '',
        'Dig out from under a rock and it',
        'falls, crushing what it lands on:',
        'creatures, or you.',
        '',
        'A creature that catches you, or a',
        'rock, costs a life; you have 3.',
        'Enter restarts.',
    ].join('\n'),
    tags: { kind: 'game', era: '1980s', genres: ['maze', 'action'] },
    screenWidth: 280,
    screenHeight: 390,
    inspiredBy: { title: 'Dig Dug', maker: 'Namco', year: 1982 },
    thumbnail,
    // The colour of its earth
    cardColor: 'peach',
    load: async () => (await import('./load')).load(),
};

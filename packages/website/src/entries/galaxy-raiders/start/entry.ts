import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Galaxy Raiders, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'galaxy-raiders',
    name: 'Galaxy Raiders',
    summary: 'Hold off waves of raiders that break formation to dive at your ship.',
    description: [
        'A fixed shooter. Raiders fly in to form ranks above you, then peel off in curving dives, firing as they come.',
        'Each wave is data, and each raider a small model with its own phase: flying in, in formation, or diving.',
    ].join('\n\n'),
    instructions: [
        'Shoot down every raider to clear',
        'the stage.',
        '',
        'Left / Right: move',
        'Space (Fire): shoot, two shots',
        'in the air at most',
        '(arrows / WASD / joystick)',
        '',
        'Raiders fly in, take their place',
        'in the ranks, then peel off to',
        'dive at you, firing as they come.',
        'A raider shot as it dives is worth',
        'more.',
        '',
        'A shot or a raider that hits you',
        'costs a ship; you have 3. Enter',
        'restarts.',
    ].join('\n'),
    tags: { kind: 'game', era: '1980s', genres: ['shooter'] },
    screenWidth: 280,
    screenHeight: 390,
    inspiredBy: { title: 'Galaga', maker: 'Namco', year: 1981 },
    thumbnail,
    // The colour of its raiders
    cardColor: 'lavender',
    load: async () => (await import('./load')).load(),
};

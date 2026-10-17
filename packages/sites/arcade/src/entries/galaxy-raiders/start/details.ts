import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Galaxy Raiders' long text, for its info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
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
};

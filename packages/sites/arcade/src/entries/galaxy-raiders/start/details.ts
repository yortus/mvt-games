import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Galaxy Raiders' long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A fixed shooter. Raiders fly in to form ranks above you, then peel off in curving dives, firing as they come.',
        'Each wave is data, and each raider a small model with its own phase: flying in, in formation, or diving.',
    ].join('\n\n'),
    howToPlay: {
        intro: 'Shoot down every raider to clear the stage.',
        controls: [
            { action: 'Move', inputs: ['left-right', 'a-d', 'joystick'] },
            { action: 'Shoot', inputs: ['space', { button: 'Fire' }], note: 'Two shots in the air at most' },
            { action: 'Restart', inputs: ['enter'] },
        ],
        notes: [
            'Raiders fly in, take their place in the ranks, then peel off to dive at you, firing as they come. A raider shot as it dives is worth more.',
            'A shot or a raider that hits you costs a ship; you have 3.',
        ],
    },
};

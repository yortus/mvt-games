import type { EntryDetails } from '@mvtjs/site-kit/entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Galaxy Raiders' long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A fixed shooter. Raiders fly in to form ranks above you, then peel off in curving dives, firing as they come.',
    implementation: 'Each wave is data, and each raider a small model with its own phase: flying in, in formation, or diving.',
    howToPlay: {
        intro: 'Shoot down every raider to clear the stage.',
        controls: [
            { action: 'Move', inputs: ['left-right', 'a-d'], touchInputs: ['drag'] },
            { action: 'Shoot', inputs: ['space'], touchInputs: ['hold'], note: 'Two shots in the air at most', touchNote: 'A finger held to steer fires too' },
            { action: 'Restart', inputs: ['enter'], touchInputs: ['tap'] },
        ],
        notes: [
            'Raiders fly in, take their place in the ranks, then peel off to dive at you, firing as they come. A raider shot as it dives is worth more.',
            'A shot or a raider that hits you costs a ship; you have 3.',
        ],
    },
};

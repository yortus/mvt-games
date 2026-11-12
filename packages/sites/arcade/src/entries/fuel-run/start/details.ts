import type { EntryDetails } from '@mvtjs/site-kit/entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Fuel Run's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A side-scrolling shooter. Your ship burns fuel as it flies; bomb the tanks on the ground to refill '
        + 'it, and shoot or dodge the rockets and saucers that launch at you.',
    implementation: 'The largest of the games, with a model for every kind of thing in the world, tested on its own.',
    howToPlay: {
        intro: 'Fly over the land, keep your fuel up, and destroy the base at the end of the run.',
        controls: [
            { action: 'Move', inputs: [{ control: 'dpad' }], touchInputs: ['drag'] },
            { action: 'Shoot', inputs: [{ control: 'primary' }], touchInputs: ['hold'], note: 'Ahead', touchNote: 'A finger held to fly fires too' },
            { action: 'Bomb', inputs: [{ control: 'secondary' }], touchInputs: [{ button: 'Bomb' }], note: 'Drops a bomb' },
            { action: 'Restart', inputs: [{ control: 'restart' }], touchInputs: ['tap'] },
        ],
        notes: [
            'Your fuel burns as you fly. Bomb the fuel tanks on the ground to fill up: run dry and you crash. Shoot or dodge the rockets and saucers that rise to meet you.',
            'Hitting the ground, or anything in the air, costs a ship; you have 3.',
        ],
    },
};

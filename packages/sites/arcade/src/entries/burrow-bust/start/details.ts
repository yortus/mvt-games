import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Burrow Bust's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A digging game. Your digger carves tunnels as it moves, creatures follow it through them, and a pump '
        + 'stops them in their tracks. Loosen a rock from below and it falls on whatever is underneath.',
        'The field is a grid model that the digger changes as it goes, and every view reads it in rows and columns.',
    ].join('\n\n'),
    howToPlay: {
        intro: 'Clear every creature from the field to finish the level.',
        controls: [
            { action: 'Move', inputs: ['arrows', 'wasd', 'joystick'], note: 'You dig as you go' },
            { action: 'Pump', inputs: ['space', { button: 'Pump' }], note: 'Shoots your pump the way you face' },
            { action: 'Restart', inputs: ['enter'] },
        ],
        notes: [
            'Hit a creature with your pump, then press again and again to blow it up until it pops. Deeper earth scores more; a salamander pumped from the side scores double.',
            'Dig out from under a rock and it falls, crushing what it lands on: creatures, or you.',
            'A creature that catches you, or a rock, costs a life; you have 3.',
        ],
    },
};

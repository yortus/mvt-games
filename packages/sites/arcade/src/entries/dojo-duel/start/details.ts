import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Dojo Duel's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A fighting game. Two fighters, one of them yours, trade punches, kicks and sweeps; a clean hit '
        + 'scores a point, and the first to three wins the round.',
    implementation: 'Each fighter is a model of phases and moves that knows nothing about poses or animation frames; the '
        + 'views choose what to draw from the phase.',
    howToPlay: {
        intro: 'First to 3 points wins a round; best of 3 rounds wins the match.',
        controls: [
            { action: 'Jump', inputs: ['up'] },
            { action: 'Foot sweep', inputs: ['down'] },
            { action: 'Punch', inputs: [['up', 'forward']] },
            { action: 'Kick', inputs: [['down', 'forward']] },
            { action: 'Flying kick', inputs: [['space', 'up']] },
            { action: 'Mid kick', inputs: [['space', 'forward']] },
            { action: 'Roundhouse', inputs: [['space', 'back']] },
            { action: 'Somersault', inputs: [['space', 'up', 'forward'], ['space', 'up', 'back']] },
        ],
        notes: [
            'Forward is toward your opponent. The arrows, WASD or the joystick give the way; Space, or Atk on a touch screen, is Attack.',
            'Standing or walking while facing your opponent blocks some attacks.',
        ],
    },
};

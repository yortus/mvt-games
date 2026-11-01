import type { ControlButton, EntryDetails } from '@mvtjs/site-kit/entry-types';

/** The Atk button the touch controls show, which turns the joystick's way into an attack, as Space does. It comes first, as the details use it. */
const ATTACK: ControlButton = { button: 'Atk' };

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
            { action: 'Jump', inputs: ['up'], touchInputs: ['up'] },
            { action: 'Foot sweep', inputs: ['down'], touchInputs: ['down'] },
            { action: 'Punch', inputs: [['up', 'forward']], touchInputs: [['up', 'forward']] },
            { action: 'Kick', inputs: [['down', 'forward']], touchInputs: [['down', 'forward']] },
            { action: 'Flying kick', inputs: [['space', 'up']], touchInputs: [[ATTACK, 'up']] },
            { action: 'Mid kick', inputs: [['space', 'forward']], touchInputs: [[ATTACK, 'forward']] },
            { action: 'Roundhouse', inputs: [['space', 'back']], touchInputs: [[ATTACK, 'back']] },
            {
                action: 'Somersault',
                inputs: [['space', 'up', 'forward'], ['space', 'up', 'back']],
                touchInputs: [[ATTACK, 'up', 'forward'], [ATTACK, 'up', 'back']],
            },
        ],
        notes: [
            'Forward is toward your opponent, and back is away from them.',
            'Standing or walking while facing your opponent blocks some attacks.',
        ],
    },
};

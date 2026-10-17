import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Dojo Duel's long text, for its info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A fighting game. Two fighters, one of them yours, trade punches, kicks and sweeps; a clean hit '
        + 'scores a point, and the first to three wins the round.',
        'Each fighter is a model of phases and moves that knows nothing about poses or animation frames; the '
        + 'views choose what to draw from the phase.',
    ].join('\n\n'),
    instructions: [
        'First to 3 points wins a round;',
        'best of 3 rounds wins the match.',
        '',
        'Forward is toward your opponent.',
        '',
        'Without Attack:',
        '  Up: jump    Down: foot sweep',
        '  Up+Fwd: punch   Down+Fwd: kick',
        '',
        'With Attack:',
        '  Up: flying kick',
        '  Fwd: mid kick   Back: roundhouse',
        '  Up+Fwd / Up+Back: somersault',
        '',
        'Standing or walking while facing',
        'your opponent blocks some attacks.',
    ].join('\n'),
};

import type { ArcadeEntry } from '../../entries';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Dojo Duel, as the arcade lists it. Its code loads on launch, from `dojo-duel-starter.ts`. */
export const dojoDuelEntry: ArcadeEntry = {
    id: 'dojo-duel',
    name: 'Dojo Duel',
    summary: 'A one-on-one karate match against the computer: punches, kicks, sweeps and blocks, best of three rounds.',
    description: [
        'A fighting game. Two fighters, one of them yours, trade punches, kicks and sweeps; a clean hit '
        + 'scores a point, and the first to three wins the round.',
        'Each fighter is a model of phases and moves that knows nothing about poses or animation frames; the '
        + 'views choose what to draw from the phase.',
    ].join('\n\n'),
    tags: { kind: 'game', era: '1980s', genres: ['fighting'] },
    screenWidth: 384,
    screenHeight: 270,
    thumbnail,
    // The colour of its wooden floor
    cardColor: 'apricot',
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
    load: async () => (await import('./dojo-duel-starter')).loadDojoDuelStarter(),
};

import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The double pendulum, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'double-pendulum',
    name: 'Double Pendulum',
    summary: 'A pendulum hung from a pendulum swings in chaos. Step it a frame at a time, slow it down, or speed it up.',
    description: [
        'Two arms, the second shorter and hanging from the end of the first, swing under gravity. The smallest change '
        + 'to where they start sends them on a different path, and a fading trail follows the lower one.',
        'Time reaches the model only through its update, and it advances in fixed one-millisecond steps. So the '
        + 'swing is the same at any frame rate, and pausing, slowing, speeding up and stepping are only changes to how much '
        + 'time it is given. The trail is the view\'s own presentation state, kept in its update step.',
    ].join('\n\n'),
    techniques: [
        'Physics in fixed time steps',
        'Pause, slow and fast motion, and frame stepping',
        'Nested containers for jointed arms',
        'Presentation state: a ring buffer trail',
    ],
    tags: { kind: 'demo', genres: ['simulation', 'tiny'] },
    screenWidth: 360,
    screenHeight: 420,
    thumbnail,
    cardColor: 'sky',
    load: async () => (await import('./load')).load(),
};

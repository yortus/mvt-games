import { combinations, type Case, type Suite } from '../harness/suite';

const GAMES = ['asteroids', 'cactii', 'digdug', 'galaga', 'ik', 'pacman', 'scramble'];
const DEMOS = ['boids', 'falling-sand', 'list-swap', 'ordered-list', 'tsx-pixi'];

/**
 * The repo's own games and demos as they ship, each started through its entry
 * and run headless: the games with scripted input, the demos unattended.
 */
export const gamesAndDemosSuite: Suite = {
    name: 'games-and-demos',
    description: 'this repo\'s games and demos, run headless through their entries with nothing rendered',
    entry: 'games-and-demos.case.ts',
    cases: [
        ...entryCases('time', []),
        ...entryCases('allocation', ['--expose-gc', '--max-semi-space-size=128']),
        ...entryCases('gc', ['--expose-gc']),
    ],
    tables: [
        {
            id: 'time',
            title: 'Time per frame, averaged over one simulated minute',
            where: { measure: 'time' },
            rows: ['kind', 'entry'],
            metrics: [
                { key: 'updateUs', title: 'Model and view updates (µs)' },
                { key: 'refreshUs', title: '`refreshScene` (µs)' },
                { key: 'totalUs', title: 'Total (µs)' },
                { key: 'containers', title: 'Pixi containers', maxDecimals: 0 },
                { key: 'methods', title: '`onUpdate` and `onRefresh` methods', maxDecimals: 0 },
            ],
        },
        {
            id: 'allocation',
            title: 'Bytes allocated per frame',
            where: { measure: 'allocation' },
            rows: ['kind', 'entry'],
            metrics: [{ key: 'bytesPerFrame', title: 'Bytes per frame', maxDecimals: 0 }],
        },
        {
            id: 'gc',
            title: 'Garbage collections over one simulated minute (3600 frames)',
            where: { measure: 'gc' },
            rows: ['kind', 'entry'],
            metrics: [
                { key: 'minorGcs', title: 'Young-generation collections', maxDecimals: 0 },
                { key: 'majorGcs', title: 'Full collections', maxDecimals: 0 },
                { key: 'gcPauseMs', title: 'Time in collections (ms)', maxDecimals: 1 },
            ],
        },
    ],
    titles: { kind: 'Kind', entry: 'Name' },
    labels: {
        kind: { game: 'Game', demo: 'Demo' },
        entry: {
            'asteroids': 'Asteroids',
            'cactii': 'Kwazy Cactii',
            'digdug': 'Dig Dug',
            'galaga': 'Galaga',
            'ik': 'International Karate',
            'pacman': 'Pac-Man',
            'scramble': 'Scramble',
            'boids': 'Boids',
            'falling-sand': 'Falling sand',
            'list-swap': 'List swap',
            'ordered-list': 'Ordered list',
            'tsx-pixi': 'TSX Pixi',
        },
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One case per game, then one per demo, for one measure. */
function entryCases(measure: string, nodeArgs: readonly string[]): Case[] {
    return [
        ...combinations({ measure: [measure], kind: ['game'], entry: GAMES }),
        ...combinations({ measure: [measure], kind: ['demo'], entry: DEMOS }),
    ].map((params): Case => (nodeArgs.length > 0 ? { params, nodeArgs } : { params }));
}

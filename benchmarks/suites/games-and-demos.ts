import { combinations, type Case, type Suite } from '../harness/suite';

const GAMES = ['asteroids', 'cactii', 'digdug', 'galaga', 'ik', 'pacman', 'scramble'];
const DEMOS = ['boids', 'falling-sand', 'reordering-lists'];

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
                { key: 'modelsUs', title: 'Models (µs)' },
                { key: 'updateUs', title: 'Update scene pass (µs)' },
                { key: 'refreshUs', title: 'Refresh scene pass (µs)' },
                { key: 'totalUs', title: 'Total (µs)' },
                { key: 'containers', title: 'Pixi containers', maxDecimals: 0 },
                { key: 'methods', title: 'Update and refresh methods', maxDecimals: 0 },
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
    notes: [
        'Since 2026-10-02, each frame is the session\'s update, which advances only its models, then a tick of the stage, timed one scene pass at a time. The time table\'s models, update scene pass and refresh scene pass columns are new: the earlier "update" column mixed the models with the views\' update methods.',
    ],
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
            'reordering-lists': 'Reordering lists',
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

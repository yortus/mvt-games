import { combinations, type Case, type Suite } from '../harness/suite';

const GAMES = ['asteroids', 'cactii', 'digdug', 'galaga', 'ik', 'pacman', 'scramble'];

/** The repo's own games, run headless with scripted input. */
export const gamesSuite: Suite = {
    name: 'games',
    description: 'this repo\'s games, run headless with scripted input and nothing rendered',
    entry: 'games.case.ts',
    cases: [
        ...combinations({ measure: ['time'], game: GAMES }).map((params): Case => ({ params })),
        ...combinations({ measure: ['allocation'], game: GAMES }).map((params): Case => ({
            params,
            nodeArgs: ['--expose-gc', '--max-semi-space-size=128'],
        })),
        ...combinations({ measure: ['gc'], game: GAMES }).map((params): Case => ({
            params,
            nodeArgs: ['--expose-gc'],
        })),
    ],
    tables: [
        {
            id: 'time',
            title: 'Time per frame, averaged over one simulated minute',
            where: { measure: 'time' },
            rows: ['game'],
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
            rows: ['game'],
            metrics: [{ key: 'bytesPerFrame', title: 'Bytes per frame', maxDecimals: 0 }],
        },
        {
            id: 'gc',
            title: 'Garbage collections over one simulated minute (3600 frames)',
            where: { measure: 'gc' },
            rows: ['game'],
            metrics: [
                { key: 'minorGcs', title: 'Young-generation collections', maxDecimals: 0 },
                { key: 'majorGcs', title: 'Full collections', maxDecimals: 0 },
                { key: 'gcPauseMs', title: 'Time in collections (ms)', maxDecimals: 1 },
            ],
        },
    ],
    titles: { game: 'Game' },
    labels: {
        game: {
            asteroids: 'Asteroids',
            cactii: 'Kwazy Cactii',
            digdug: 'Dig Dug',
            galaga: 'Galaga',
            ik: 'International Karate',
            pacman: 'Pac-Man',
            scramble: 'Scramble',
        },
    },
};

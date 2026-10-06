import { combinations, type Suite } from '../harness/suite';
import { APPROACH_LABELS } from './labels';

/** What it costs to create and destroy Pixi containers, and to avoid doing so. */
export const constructionSuite: Suite = {
    name: 'construction',
    description: 'building and destroying Pixi containers, and reusing them from a pool',
    entry: 'construction.case.ts',
    cases: [
        ...combinations({
            scenario: ['build'],
            approach: ['container-only', 'hand-written', 'jsx', 'events', 'solid'],
        }),
        ...combinations({
            scenario: ['pool'],
            spawnPerFrame: [5, 50],
            approach: ['list', 'rebuild'],
        }),
    ].map((params) => ({ params })),
    tables: [
        {
            id: 'build',
            title: 'One Pixi container and its model record, from construction to destruction',
            metric: 'usPerContainer',
            maxDecimals: 3,
            unit: 'µs',
            where: { scenario: 'build' },
            rows: ['scenario'],
            column: 'approach',
        },
        {
            id: 'pool',
            title: 'About 500 short-lived items alive at once: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { scenario: 'pool' },
            rows: ['spawnPerFrame'],
            column: 'approach',
        },
    ],
    labels: {
        scenario: { build: 'build, first update, destroy' },
        approach: {
            ...APPROACH_LABELS,
            'container-only': 'bare container',
            'list': '`<List>` over a `SlotList` (reuses containers)',
            'rebuild': 'build and destroy a container per item',
        },
    },
};

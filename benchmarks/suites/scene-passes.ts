import type { Suite } from '../harness/suite';

/** The cost of the scene passes themselves. */
export const scenePassesSuite: Suite = {
    name: 'scene-passes',
    description: 'refreshScene against a plain recursive walk, Pixi\'s onRender, and skipped subtrees',
    entry: 'scene-passes.case.ts',
    cases: [
        { scenario: 'sparse', approach: 'naive' },
        { scenario: 'sparse', approach: 'memo' },
        { scenario: 'dense', approach: 'naive' },
        { scenario: 'dense', approach: 'onRender' },
        { scenario: 'dense', approach: 'memo' },
        { scenario: 'churn', approach: 'naive' },
        { scenario: 'churn', approach: 'memo' },
        { scenario: 'attach', approach: 'naive' },
        { scenario: 'attach', approach: 'memo' },
        // Differ only in whether this process ever imported the plugin
        { scenario: 'mutation', approach: 'unpatched' },
        { scenario: 'mutation', approach: 'patched' },
        { scenario: 'skip', approach: 'hidden' },
        { scenario: 'skip', approach: 'skip' },
    ].map((params) => ({ params })),
    tables: [
        {
            id: 'passes',
            title: 'The scene passes',
            rows: ['scenario', 'approach'],
            metrics: [
                { key: 'usPerFrame', title: 'Time per frame (µs)' },
                { key: 'callsPerFrame', title: 'Method calls per frame', maxDecimals: 0 },
            ],
        },
    ],
    labels: {
        scenario: {
            sparse: '20,000 containers, 200 with an `onRefresh`',
            dense: '2,000 containers, all with an `onRefresh`',
            churn: '2,000 containers, all with an `onRefresh`, 100 replaced per frame',
            attach: '100 subtrees of 25 containers without `onRefresh`, detached and re-attached per frame',
            mutation: '100 containers added and removed per frame, no pass run',
            skip: '10,000 containers with an `onRefresh` each, in 100 groups, 90 groups inactive',
        },
        approach: {
            naive: 'plain recursive walk',
            memo: '`refreshScene`',
            onRender: 'Pixi `onRender`',
            unpatched: 'plugin not imported',
            patched: 'plugin imported',
            hidden: 'inactive groups hidden (`visible = false`) only',
            skip: 'inactive groups return `SKIP_DESCENDANTS`',
        },
    },
};

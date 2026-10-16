import type { Suite } from '../harness/suite';

/** The cost of `refreshView` itself. */
export const refreshViewSuite: Suite = {
    name: 'refresh-view',
    description: 'refreshView against a plain recursive walk, Pixi\'s onRender, and skipped subtrees',
    entry: 'refresh-view.case.ts',
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
        // Differ only in whether this process ever imported @mvtjs/pixi
        { scenario: 'mutation', approach: 'unpatched' },
        { scenario: 'mutation', approach: 'patched' },
        { scenario: 'skip', approach: 'hidden' },
        { scenario: 'skip', approach: 'skip' },
    ].map((params) => ({ params })),
    tables: [
        {
            id: 'passes',
            title: '`refreshView` and its alternatives',
            rows: ['scenario', 'approach'],
            metrics: [
                { key: 'usPerFrame', title: 'Time per frame (µs)' },
                { key: 'callsPerFrame', title: 'Method calls per frame', maxDecimals: 0 },
            ],
        },
    ],
    labels: {
        scenario: {
            sparse: '20,000 containers, 200 with a refresh method',
            dense: '2,000 containers, all with a refresh method',
            churn: '2,000 containers, all with a refresh method, 100 replaced per frame',
            attach: '100 subtrees of 25 containers without a refresh method, detached and re-attached per frame',
            mutation: '100 containers added and removed per frame, no `refreshView`',
            skip: '10,000 containers with a refresh method each, in 100 groups, 90 groups inactive',
        },
        approach: {
            naive: 'plain recursive walk',
            memo: '`refreshView`',
            onRender: 'Pixi `onRender`',
            unpatched: '@mvtjs/pixi not imported',
            patched: '@mvtjs/pixi imported',
            hidden: 'inactive groups hidden (`visible = false`) only',
            skip: 'inactive groups return `SKIP_DESCENDANTS`',
        },
    },
};

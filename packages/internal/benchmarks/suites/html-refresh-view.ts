import { combinations, type Suite } from '../harness/suite';

/** `refreshView` on the DOM, in headless Chrome: against a naive walk, and with two targets in one page. */
export const htmlRefreshViewSuite: Suite = {
    name: 'html-refresh-view',
    description: 'refreshView on the DOM in headless Chrome: against a naive walk, and with two JSX targets in one page',
    entry: 'html-refresh-view.case.ts',
    environment: 'browser',
    cases: [
        ...combinations({
            scene: ['walk'],
            methods: ['all', 'sparse', 'churn'],
            count: [1000, 10000],
            walk: ['memoised', 'naive'],
        }),
        ...combinations({
            scene: ['two-targets'],
            measured: ['html', 'three'],
            other: ['none', 'warmed'],
        }),
    ].map((params) => ({ params })),
    tables: [
        {
            id: 'walk',
            title: '`refreshView` over a DOM tree against a naive walk of it: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { scene: 'walk' },
            rows: ['methods', 'count'],
            column: 'walk',
        },
        {
            id: 'two-targets',
            title: 'A 1000-item JSX list refreshed alone, and after a list on the other target has run in the same page: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { scene: 'two-targets' },
            rows: ['measured'],
            column: 'other',
        },
    ],
    labels: {
        methods: {
            all: 'Every element has a method',
            sparse: '1 in 20 has one',
            churn: 'Every element, and a child added or removed each frame',
        },
        walk: {
            memoised: '`refreshView` (cached method lists)',
            naive: 'Naive walk',
        },
        measured: {
            html: 'HTML list',
            three: 'three.js list',
        },
        other: {
            none: 'Alone',
            warmed: 'After the other target\'s',
        },
    },
    notes: [
        'Since 2026-10-02, the naive walk reads each element\'s method from its own property, rather than through an accessor the library no longer installs. That made it 2-6% faster than in earlier saved results; `refreshView` is unchanged.',
    ],
    titles: {
        methods: 'Methods',
        count: 'Elements',
        measured: 'Measured',
    },
};

import { combinations, type Suite } from '../harness/suite';

/** The DOM's scene passes, in headless Chrome: the memoised walk against a naive one, and two targets in one page. */
export const htmlScenePassesSuite: Suite = {
    name: 'html-scene-passes',
    description: 'the DOM\'s scene passes in headless Chrome: the memoised walk against a naive one, and two JSX targets in one page',
    entry: 'html-scene-passes.case.ts',
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
            title: 'refreshScene over a DOM tree against a naive walk of it: time per frame',
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
            memoised: 'refreshScene (memoised)',
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
    titles: {
        methods: 'Methods',
        count: 'Elements',
        measured: 'Measured',
    },
};

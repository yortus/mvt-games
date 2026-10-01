import { combinations, type Suite } from '../harness/suite';

/** The JSX runtime's refresh methods, against hand-written ones. */
export const jsxRefreshSuite: Suite = {
    name: 'jsx-refresh',
    description: 'refreshing JSX bindings, against hand-written methods, on one kind of element and on many',
    entry: 'jsx-refresh.case.ts',
    cases: combinations({
        scene: ['uniform', 'mixed', 'kinds'],
        count: [1000, 10000, 50000],
        approach: ['hand-written', 'jsx'],
    }).map((params) => ({ params })),
    tables: [
        {
            id: 'uniform',
            title: 'Containers binding x, y and alpha, all changing every frame: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { scene: 'uniform' },
            rows: ['count'],
            column: 'approach',
        },
        {
            id: 'mixed',
            title: 'Six element shapes over every write kind: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { scene: 'mixed' },
            rows: ['count'],
            column: 'approach',
        },
        {
            id: 'kinds',
            title: 'All eight kinds of Pixi element, binding x, y, alpha and rotation: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { scene: 'kinds' },
            rows: ['count'],
            column: 'approach',
        },
    ],
    labels: {
        approach: {
            'hand-written': 'MVT (hand-written)',
            'jsx': 'MVT (JSX)',
        },
    },
};

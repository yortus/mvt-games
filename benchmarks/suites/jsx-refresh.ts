import { combinations, type Suite } from '../harness/suite';

/** The JSX runtime's generated refresh methods, against its eval-free fallback and hand-written methods. */
export const jsxRefreshSuite: Suite = {
    name: 'jsx-refresh',
    description: 'refreshing JSX bindings: generated code, the fallback for pages that forbid it, and hand-written methods',
    entry: 'jsx-refresh.case.ts',
    cases: combinations({
        scene: ['uniform', 'mixed'],
        count: [1000, 10000],
        approach: ['hand-written', 'generated', 'fallback'],
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
    ],
    labels: {
        approach: {
            'hand-written': 'MVT (hand-written)',
            'generated': 'MVT (JSX, generated code)',
            'fallback': 'MVT (JSX, fallback)',
        },
    },
};

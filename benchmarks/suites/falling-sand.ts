import { combinations, type MetricColumn, type Suite } from '../harness/suite';

const METRICS: readonly MetricColumn[] = [
    { key: 'movingGrains', title: 'Moving grains', maxDecimals: 0 },
    { key: 'modelUs', title: 'Model (µs)' },
    { key: 'updateUs', title: '`updateScene` (µs)' },
    { key: 'refreshUs', title: '`refreshScene` (µs)' },
    { key: 'totalUs', title: 'Total (µs)' },
    { key: 'refreshNsPerGrain', title: 'Refresh per grain (ns)' },
    { key: 'readsPerFrame', title: 'Prop reads per frame', maxDecimals: 0 },
];

/** The falling-sand demo: one sprite per grain, from 1,000 to 20,000 grains. */
export const fallingSandSuite: Suite = {
    name: 'falling-sand',
    description: 'the falling-sand demo headless, from 1,000 to 20,000 grains, settled and flipping',
    entry: 'falling-sand.case.ts',
    cases: combinations({
        scenario: ['settled', 'flipping'],
        grains: [1000, 5000, 10000, 20000],
    }).map((params) => ({ params })),
    tables: [
        {
            id: 'settled',
            title: 'Every grain settled: time per frame',
            where: { scenario: 'settled' },
            rows: ['grains'],
            metrics: METRICS,
        },
        {
            id: 'flipping',
            title: 'Flipping every 3 seconds: time per frame',
            where: { scenario: 'flipping' },
            rows: ['grains'],
            metrics: METRICS,
        },
    ],
    titles: { grains: 'Grains' },
    labels: {
        grains: { 1000: '1,000', 5000: '5,000', 10000: '10,000', 20000: '20,000' },
    },
};

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

const VARIANTS = ['objects-sprites', 'arrays-sprites', 'objects-pixels', 'arrays-pixels'];
const GRAINS = [1000, 5000, 10000, 20000, 50000, 100000, 200000];

/**
 * How the falling-sand demo's frame cost scales with its grain count, from
 * 1,000 to 200,000 grains, for each of its model and view variants: a record
 * per grain or a typed array per field in the model, and a sprite per grain
 * or a pixel per cell in the view. The demo as it ships is in the
 * `games-and-demos` suite.
 */
export const fallingSandScalingSuite: Suite = {
    name: 'falling-sand-scaling',
    description: 'the falling-sand demo headless, from 1,000 to 200,000 grains, settled and flipping, per model and view variant',
    entry: 'falling-sand-scaling.case.ts',
    cases: combinations({
        scenario: ['settled', 'flipping'],
        variant: VARIANTS,
        grains: GRAINS,
    }).map((params) => ({ params })),
    tables: [
        {
            id: 'settled-total',
            title: 'Every grain settled: total time per frame, by variant',
            where: { scenario: 'settled' },
            rows: ['grains'],
            metric: 'totalUs',
            unit: 'µs',
            column: 'variant',
        },
        {
            id: 'flipping-total',
            title: 'Flipping every 3 seconds: total time per frame, by variant',
            where: { scenario: 'flipping' },
            rows: ['grains'],
            metric: 'totalUs',
            unit: 'µs',
            column: 'variant',
        },
        {
            id: 'settled',
            title: 'Every grain settled: time per frame',
            where: { scenario: 'settled' },
            rows: ['variant', 'grains'],
            metrics: METRICS,
        },
        {
            id: 'flipping',
            title: 'Flipping every 3 seconds: time per frame',
            where: { scenario: 'flipping' },
            rows: ['variant', 'grains'],
            metrics: METRICS,
        },
    ],
    titles: { grains: 'Grains', variant: 'Model, view' },
    labels: {
        grains: {
            1000: '1,000', 5000: '5,000', 10000: '10,000', 20000: '20,000',
            50000: '50,000', 100000: '100,000', 200000: '200,000',
        },
        variant: {
            'objects-sprites': 'objects, sprites',
            'arrays-sprites': 'arrays, sprites',
            'objects-pixels': 'objects, pixels',
            'arrays-pixels': 'arrays, pixels',
        },
    },
};

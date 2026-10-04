import { combinations, type Suite } from '../harness/suite';
import { APPROACH_LABELS } from './labels';

/** How the cost of keeping a view in step grows with the number of containers. */
export const scalingSuite: Suite = {
    name: 'scaling',
    description: 'time per frame from 100 to 100,000 Pixi containers',
    entry: 'synced-scene.case.ts',
    cases: combinations({
        changedPercent: [0, 100],
        count: [100, 1000, 10000, 100000],
        approach: ['hand-written', 'jsx', 'solid'],
        dynamicProperties: [3],
    }).map((params) => ({ params })),
    tables: [
        {
            id: 'unchanged',
            title: 'Nothing changed: time per frame per container',
            metric: 'nsPerContainer',
            unit: 'ns',
            where: { changedPercent: 0 },
            rows: ['count'],
            column: 'approach',
        },
        {
            id: 'all-changed',
            title: 'Every container changed each frame: time per frame per container',
            metric: 'nsPerContainer',
            unit: 'ns',
            where: { changedPercent: 100 },
            rows: ['count'],
            column: 'approach',
        },
        {
            id: 'frame-time',
            title: 'Every container changed each frame: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { changedPercent: 100 },
            rows: ['count'],
            column: 'approach',
        },
    ],
    labels: {
        approach: APPROACH_LABELS,
        count: { 100: '100', 1000: '1,000', 10000: '10,000', 100000: '100,000' },
    },
};

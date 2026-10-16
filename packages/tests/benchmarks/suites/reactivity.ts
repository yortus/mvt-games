import { combinations, type Suite } from '../harness/suite';
import { APPROACH_LABELS, DYNAMIC_PROPERTIES_LABELS } from './labels';

/** Polling against signals and events, as the share changed per frame varies. */
export const reactivitySuite: Suite = {
    name: 'reactivity',
    description: 'keeping 1000 Pixi containers in step with a changing model',
    entry: 'synced-scene.case.ts',
    cases: combinations({
        dynamicProperties: [3, 1],
        changedPercent: [0, 1, 10, 50, 100],
        approach: ['model-only', 'hand-written', 'jsx', 'events', 'solid'],
        count: [1000],
    }).map((params) => ({ params })),
    tables: [
        {
            id: 'three-dynamic',
            title: '1000 containers, 3 dynamic properties each: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { dynamicProperties: 3 },
            rows: ['changedPercent'],
            column: 'approach',
        },
        {
            id: 'one-dynamic',
            title: '1000 containers, 1 dynamic property and 2 static properties each: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { dynamicProperties: 1 },
            rows: ['changedPercent'],
            column: 'approach',
        },
    ],
    labels: {
        approach: APPROACH_LABELS,
        dynamicProperties: DYNAMIC_PROPERTIES_LABELS,
        changedPercent: { 0: '0%', 1: '1%', 10: '10%', 50: '50%', 100: '100%' },
    },
};

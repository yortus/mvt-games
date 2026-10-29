import { combinations, type Suite } from '../harness/suite';
import { APPROACH_LABELS } from './labels';

/** Reacting to occasional changes, and computing values derived from several model values. */
export const changeDetectionSuite: Suite = {
    name: 'change-detection',
    description: '1000 Pixi containers reacting to state that changes occasionally',
    entry: 'change-detection.case.ts',
    cases: [
        ...combinations({
            scenario: ['discrete'],
            changedPercent: [0, 1, 10],
            approach: ['manual', 'watch', 'events', 'solid'],
        }),
        ...combinations({
            scenario: ['derived'],
            changedPercent: [0, 10, 100],
            approach: ['recompute', 'watch', 'events', 'solid'],
        }),
    ].map((params) => ({ params })),
    tables: [
        {
            id: 'discrete',
            title: 'A value that changes occasionally, updating two properties when it does: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { scenario: 'discrete' },
            rows: ['changedPercent'],
            column: 'approach',
        },
        {
            id: 'derived',
            title: 'A property computed from 8 model values: time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { scenario: 'derived' },
            rows: ['changedPercent'],
            column: 'approach',
        },
    ],
    labels: {
        changedPercent: { 0: '0%', 1: '1%', 10: '10%', 100: '100%' },
        approach: { ...APPROACH_LABELS, manual: 'compare by hand', watch: '`watch()`', recompute: 'recompute every frame' },
    },
};

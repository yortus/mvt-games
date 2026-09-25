import { combinations, type Case, type Suite } from '../harness/suite';
import { APPROACH_LABELS } from './labels';

const ALLOCATION_FLAGS = ['--expose-gc', '--max-semi-space-size=128'];
const GC_FLAGS = ['--expose-gc'];

const SYNCED = ['hand-written', 'jsx', 'events', 'solid', 'wasteful'];

const GC_METRICS = [
    { key: 'minorGcs', title: 'Young-generation collections', maxDecimals: 0 },
    { key: 'majorGcs', title: 'Full collections', maxDecimals: 0 },
    { key: 'gcPauseMs', title: 'Time in collections (ms)', maxDecimals: 1 },
];

/** Allocation, garbage collection and memory kept alive. Separate from the timing suites. */
export const memorySuite: Suite = {
    name: 'memory',
    description: 'bytes allocated per frame, garbage collections, and memory per container',
    entry: 'memory.case.ts',
    cases: [
        ...withFlags(combinations({
            measure: ['allocation'],
            scene: ['synced'],
            changedPercent: [0, 10, 100],
            approach: SYNCED,
        }), ALLOCATION_FLAGS),
        ...withFlags(combinations({
            measure: ['allocation'],
            scene: ['discrete'],
            changedPercent: [10],
            approach: ['manual', 'watch', 'events', 'solid'],
        }), ALLOCATION_FLAGS),
        ...withFlags(combinations({
            measure: ['allocation'],
            scene: ['pool'],
            spawnPerFrame: [50],
            approach: ['list', 'rebuild'],
        }), ALLOCATION_FLAGS),
        ...withFlags(combinations({
            measure: ['gc'],
            scene: ['synced'],
            changedPercent: [100],
            approach: SYNCED,
        }), GC_FLAGS),
        ...withFlags(combinations({
            measure: ['gc'],
            scene: ['pool'],
            spawnPerFrame: [50],
            approach: ['list', 'rebuild'],
        }), GC_FLAGS),
        ...withFlags(combinations({
            measure: ['retained'],
            scene: ['synced'],
            approach: ['container-only', 'hand-written', 'jsx', 'events', 'solid'],
        }), GC_FLAGS),
    ],
    tables: [
        {
            id: 'allocation',
            title: '1000 containers, 3 dynamic properties each: bytes allocated per frame',
            metric: 'bytesPerFrame',
            maxDecimals: 0,
            unit: 'bytes',
            where: { measure: 'allocation', scene: 'synced' },
            rows: ['changedPercent'],
            column: 'approach',
        },
        {
            id: 'allocation-discrete',
            title: '1000 containers reacting to a value that changes occasionally, 10% changed per frame: bytes allocated per frame',
            metric: 'bytesPerFrame',
            maxDecimals: 0,
            unit: 'bytes',
            where: { measure: 'allocation', scene: 'discrete' },
            rows: ['changedPercent'],
            column: 'approach',
        },
        {
            id: 'allocation-pool',
            title: 'About 500 short-lived items, 50 new per frame: bytes allocated per frame',
            metric: 'bytesPerFrame',
            maxDecimals: 0,
            unit: 'bytes',
            where: { measure: 'allocation', scene: 'pool' },
            rows: ['spawnPerFrame'],
            column: 'approach',
        },
        {
            id: 'gc',
            title: '1000 containers, 3 dynamic properties, all changed every frame, for one simulated minute (3600 frames)',
            where: { measure: 'gc', scene: 'synced' },
            rows: ['approach'],
            metrics: GC_METRICS,
        },
        {
            id: 'gc-pool',
            title: 'About 500 short-lived items, 50 new per frame, for one simulated minute (3600 frames)',
            where: { measure: 'gc', scene: 'pool' },
            rows: ['approach'],
            metrics: GC_METRICS,
        },
        {
            id: 'retained',
            title: 'Memory kept alive per Pixi container and its model record',
            metric: 'bytesPerContainer',
            maxDecimals: 0,
            unit: 'bytes',
            where: { measure: 'retained' },
            rows: ['measure'],
            column: 'approach',
        },
    ],
    labels: {
        changedPercent: { 0: '0% changed', 10: '10% changed', 100: '100% changed' },
        spawnPerFrame: { 50: '50 new per frame' },
        scene: { synced: '1000 containers, 3 dynamic properties', pool: 'about 500 short-lived items, 50 new per frame' },
        measure: { retained: 'per container' },
        approach: {
            ...APPROACH_LABELS,
            'container-only': 'bare container',
            'manual': 'compare by hand',
            'watch': '`watch()`',
            'list': '`<List>` over a `SlotList`',
            'rebuild': 'build and destroy per item',
        },
    },
};

function withFlags(params: Record<string, string | number>[], nodeArgs: readonly string[]): Case[] {
    return params.map((p) => ({ params: p, nodeArgs }));
}

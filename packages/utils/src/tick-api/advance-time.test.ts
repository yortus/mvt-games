import { describe, expect, it } from 'vitest';
import { advanceTime } from './advance-time';
import { registerRenderer, setUpdate } from './tick-api';

// ---------------------------------------------------------------------------
// A renderer of plain objects
// ---------------------------------------------------------------------------

interface TestNode {
    readonly children: TestNode[];
    parent: TestNode | undefined;
}

declare module './renderer-views' {
    interface RendererViews {
        advanceTimeTest: TestNode;
    }
}

const testNodePrototype = {} as TestNode;

registerRenderer<TestNode>({
    prototype: testNodePrototype,
    children: (node) => node.children,
    parent: (node) => node.parent,
    describe: () => 'node',
});

function plainNode(): TestNode {
    const node = Object.create(testNodePrototype) as { -readonly [K in keyof TestNode]: TestNode[K] };
    node.children = [];
    node.parent = undefined;
    return node;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('advanceTime', () => {
    it('advances in frame-sized steps, with a shorter last step', async () => {
        const steps: number[] = [];
        await advanceTime(40, { update: (ms) => steps.push(ms) });
        expect(steps).toEqual([16, 16, 8]);
    });

    it('updates every model, then every view, in each step, whatever the order given', async () => {
        const calls: string[] = [];
        const view = plainNode();
        setUpdate(view, () => {
            calls.push('view');
        });
        await advanceTime(32, view, { update: () => calls.push('a') }, { update: () => calls.push('b') });
        expect(calls).toEqual(['a', 'b', 'view', 'a', 'b', 'view']);
    });

    it('updates a view as a view, even if it has an update method of its own', async () => {
        const calls: string[] = [];
        const view = Object.assign(plainNode(), { update: () => calls.push('own update') });
        setUpdate(view, () => {
            calls.push('update method');
        });
        await advanceTime(16, view);
        expect(calls).toEqual(['update method']);
    });

    it('throws for an argument that is neither a view nor has an update method', async () => {
        await expect(advanceTime(16, {} as never)).rejects.toThrow(/neither a view nor has an update method/);
    });

    it('lets a model that awaits a promise move on between steps', async () => {
        let resolved = 0;
        const model = {
            update: () => {
                void Promise.resolve().then(() => resolved++);
            },
        };
        await advanceTime(48, model);
        expect(resolved).toBe(3);
    });
});

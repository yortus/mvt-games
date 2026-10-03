import { describe, expect, it } from 'vitest';
import { SKIP_DESCENDANTS } from './skip-descendants';
import { refreshView, registerRenderer, setRefresh, setUpdate, updateView } from './tick-api';
import { addReads, countTick, tickCounter } from './tick-counter';

// ---------------------------------------------------------------------------
// A renderer of plain objects
// ---------------------------------------------------------------------------

interface CountedNode {
    readonly label: string;
    readonly children: CountedNode[];
    parent: CountedNode | undefined;
}

declare module './renderer-views' {
    interface RendererViews {
        tickCounterTest: CountedNode;
    }
}

const countedNodePrototype = {} as CountedNode;

const { invalidate } = registerRenderer<CountedNode>({
    prototype: countedNodePrototype,
    children: (node) => node.children,
    parent: (node) => node.parent,
    describe: (node) => node.label,
});

function plainNode(label: string): CountedNode {
    return Object.assign(Object.create(countedNodePrototype) as CountedNode, { label, children: [], parent: undefined });
}

function append(parent: CountedNode, child: CountedNode): void {
    parent.children.push(child);
    child.parent = parent;
    invalidate(parent);
}

/** A root with `count` children, each with an update and a refresh method. */
function sceneOf(count: number): CountedNode {
    const root = plainNode('root');
    for (let i = 0; i < count; i++) {
        const child = plainNode(`child ${i}`);
        setUpdate(child, () => undefined);
        setRefresh(child, () => undefined);
        append(root, child);
    }
    return root;
}

function tick(root: CountedNode): void {
    updateView(root, 16);
    refreshView(root);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tick counter', () => {
    it('counts the methods called, and the method lists a first tick builds', () => {
        const root = sceneOf(3);

        const counts = countTick(() => tick(root));

        expect(counts.methodCalls).toBe(6);
        expect(counts.methodListRebuilds).toBe(2);
        // Each rebuild visits the root and its three children
        expect(counts.rebuildNodeVisits).toBe(8);
    });

    it('counts no rebuilds in a steady scene', () => {
        const root = sceneOf(3);
        tick(root);

        const counts = countTick(() => tick(root));

        expect(counts).toEqual({ reads: 0, methodCalls: 6, methodListRebuilds: 0, rebuildNodeVisits: 0 });
    });

    it('counts the rebuilds a change to the tree causes', () => {
        const root = sceneOf(3);
        tick(root);
        append(root, plainNode('plain'));

        const counts = countTick(() => refreshView(root));

        expect(counts.methodCalls).toBe(3);
        expect(counts.methodListRebuilds).toBe(1);
        expect(counts.rebuildNodeVisits).toBe(5);
    });

    it('counts only the methods called, not those skipped', () => {
        const root = sceneOf(3);
        setRefresh(root, () => SKIP_DESCENDANTS);

        const counts = countTick(() => refreshView(root));

        expect(counts.methodCalls).toBe(1);
    });

    it('counts the methods a refresh catches up', () => {
        const root = sceneOf(0);
        setRefresh(root, () => {
            if (root.children.length > 0) return;
            const child = plainNode('added');
            setRefresh(child, () => undefined);
            append(root, child);
        });

        const counts = countTick(() => refreshView(root));

        expect(counts.methodCalls).toBe(2);
        expect(counts.methodListRebuilds).toBe(2);
    });

    it('counts the reads added while measuring', () => {
        const counts = countTick(() => {
            addReads(3);
            addReads(4);
        });

        expect(counts.reads).toBe(7);
    });

    it('counts nothing while off', () => {
        const root = sceneOf(3);
        const before = { ...tickCounter };

        tick(root);
        addReads(5);

        expect(tickCounter).toEqual(before);
    });

    it('restores the previous on/off state after counting', () => {
        tickCounter.isCounting = true;
        try {
            countTick(() => undefined);
            expect(tickCounter.isCounting).toBe(true);
        }
        finally {
            tickCounter.isCounting = false;
        }
    });

    it('counts a nested measurement in the outer one too', () => {
        let inner = 0;
        const outer = countTick(() => {
            addReads(2);
            inner = countTick(() => addReads(3)).reads;
        });

        expect(inner).toBe(3);
        expect(outer.reads).toBe(5);
    });
});

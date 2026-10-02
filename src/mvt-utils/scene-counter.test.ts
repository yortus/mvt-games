import { describe, expect, it } from 'vitest';
import { countScene, sceneCounter } from './scene-counter';
import { createScenePasses, setTickMethods } from './scene-passes';
import { SKIP_DESCENDANTS } from './skip-descendants';

// ---------------------------------------------------------------------------
// A tree of plain objects
// ---------------------------------------------------------------------------

interface PlainNode {
    readonly label: string;
    readonly children: PlainNode[];
    parent: PlainNode | undefined;
}

const passes = createScenePasses<PlainNode>({
    children: (node) => node.children,
    parent: (node) => node.parent,
    describe: (node) => node.label,
});

function plainNode(label: string): PlainNode {
    return { label, children: [], parent: undefined };
}

function append(parent: PlainNode, child: PlainNode): void {
    parent.children.push(child);
    child.parent = parent;
    passes.invalidate(parent);
}

/** A root with `count` children, each with an update and a refresh method. */
function sceneOf(count: number): PlainNode {
    const root = plainNode('root');
    for (let i = 0; i < count; i++) {
        const child = plainNode(`child ${i}`);
        setTickMethods(child, { update: () => undefined, refresh: () => undefined });
        append(root, child);
    }
    return root;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scene counter', () => {
    it('counts the methods called, and the walks a first tick builds', () => {
        const root = sceneOf(3);

        const counts = countScene(() => passes.tickScene({ root, deltaMs: 16 }));

        expect(counts.methodCalls).toBe(6);
        expect(counts.walkRebuilds).toBe(2);
        // Each walk visits the root and its three children
        expect(counts.rebuildVisits).toBe(8);
    });

    it('counts no rebuilds in a steady scene', () => {
        const root = sceneOf(3);
        passes.tickScene({ root, deltaMs: 16 });

        const counts = countScene(() => passes.tickScene({ root, deltaMs: 16 }));

        expect(counts).toEqual({ methodCalls: 6, walkRebuilds: 0, rebuildVisits: 0 });
    });

    it('counts the rebuilds a change to the tree causes', () => {
        const root = sceneOf(3);
        passes.tickScene({ root, deltaMs: 16 });
        append(root, plainNode('plain'));

        const counts = countScene(() => passes.tickScene({ root, only: 'refresh' }));

        expect(counts.methodCalls).toBe(3);
        expect(counts.walkRebuilds).toBe(1);
        expect(counts.rebuildVisits).toBe(5);
    });

    it('counts only the methods called, not those skipped', () => {
        const root = sceneOf(3);
        setTickMethods(root, { refresh: () => SKIP_DESCENDANTS });

        const counts = countScene(() => passes.tickScene({ root, only: 'refresh' }));

        expect(counts.methodCalls).toBe(1);
    });

    it('counts the methods a refresh scene pass catches up', () => {
        const root = sceneOf(0);
        setTickMethods(root, {
            refresh: () => {
                if (root.children.length > 0) return;
                const child = plainNode('added');
                setTickMethods(child, { refresh: () => undefined });
                append(root, child);
            },
        });

        const counts = countScene(() => passes.tickScene({ root, only: 'refresh' }));

        expect(counts.methodCalls).toBe(2);
        expect(counts.walkRebuilds).toBe(2);
    });

    it('counts nothing while off', () => {
        const root = sceneOf(3);
        const before = { ...sceneCounter };

        passes.tickScene({ root, deltaMs: 16 });

        expect(sceneCounter).toEqual(before);
    });

    it('restores the previous on/off state after counting', () => {
        sceneCounter.isCounting = true;
        try {
            countScene(() => undefined);
            expect(sceneCounter.isCounting).toBe(true);
        }
        finally {
            sceneCounter.isCounting = false;
        }
    });
});

import { Group, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { destroyObject, isDestroyed, onDestroyed, refreshScene, updateScene } from './object3d-mixin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A group whose `onRefresh` records its name in `calls`. */
function recorded(name: string, calls: string[]): Group {
    const group = new Group();
    group.name = name;
    group.onRefresh = () => void calls.push(name);
    return group;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// The structural paths three.js takes, each of which must invalidate the
// memoised walk. The walk itself is covered by pixi-mvt's tests and the
// conformance suite.
describe('three-mvt scene passes', () => {
    it('runs every method in a subtree, parents first, and updates with the time', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const child = recorded('child', calls);
        root.add(child);
        child.add(recorded('grandchild', calls));
        const deltas: number[] = [];
        child.onUpdate = (deltaMs) => void deltas.push(deltaMs);

        refreshScene(root);
        updateScene(root, 16);

        expect(calls).toEqual(['root', 'child', 'grandchild']);
        expect(deltas).toEqual([16]);
    });

    it('follows add, remove and clear after the walk was first built', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        refreshScene(root);

        const a = recorded('a', calls);
        const b = recorded('b', calls);
        root.add(a, b);
        calls.length = 0;
        refreshScene(root);
        expect(calls).toEqual(['root', 'a', 'b']);

        root.remove(a);
        calls.length = 0;
        refreshScene(root);
        expect(calls).toEqual(['root', 'b']);

        root.clear();
        calls.length = 0;
        refreshScene(root);
        expect(calls).toEqual(['root']);
    });

    it('follows removeFromParent and reparenting on both sides', () => {
        const calls: string[] = [];
        const left = recorded('left', calls);
        const right = recorded('right', calls);
        const moving = recorded('moving', calls);
        left.add(moving);
        refreshScene(left);
        refreshScene(right);

        // `add` detaches from the old parent through `removeFromParent`
        right.add(moving);
        calls.length = 0;
        refreshScene(left);
        refreshScene(right);
        expect(calls).toEqual(['left', 'right', 'moving']);

        moving.removeFromParent();
        calls.length = 0;
        refreshScene(right);
        expect(calls).toEqual(['right']);
    });

    it('follows attach, which does not go through add', () => {
        const calls: string[] = [];
        const from = recorded('from', calls);
        const to = recorded('to', calls);
        const moving = recorded('moving', calls);
        from.add(moving);
        refreshScene(from);
        refreshScene(to);

        to.attach(moving);
        calls.length = 0;
        refreshScene(from);
        refreshScene(to);

        expect(calls).toEqual(['from', 'to', 'moving']);
    });

    it('follows a method assigned after the walk was built', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const quiet: Object3D = new Group();
        root.add(quiet);
        refreshScene(root);

        quiet.onRefresh = () => void calls.push('quiet');
        calls.length = 0;
        refreshScene(root);

        expect(calls).toEqual(['root', 'quiet']);
    });

    describe('destroyObject', () => {
        it('runs onDestroyed callbacks parent first, once, then detaches and silences the subtree', () => {
            const calls: string[] = [];
            const root = recorded('root', calls);
            const doomed = recorded('doomed', calls);
            const inner = recorded('inner', calls);
            root.add(doomed);
            doomed.add(inner);
            const destroyed: string[] = [];
            onDestroyed(doomed, (node) => void destroyed.push(node.name));
            onDestroyed(inner, (node) => void destroyed.push(node.name));

            destroyObject(doomed);
            destroyObject(doomed);

            expect(destroyed).toEqual(['doomed', 'inner']);
            expect(doomed.parent).toBeNull();
            expect(isDestroyed(inner)).toBe(true);
            // A destroyed node passed to refreshScene itself runs nothing
            calls.length = 0;
            refreshScene(doomed);
            expect(calls).toEqual([]);
        });
    });
});

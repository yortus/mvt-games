import { Group, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { destroyObject, isDestroyed, onDestroyed, setTickMethods, tickScene } from './object3d-mixin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A group whose refresh method records its name in `calls`. */
function recorded(name: string, calls: string[]): Group {
    const group = new Group();
    group.name = name;
    setTickMethods(group, { refresh: () => void calls.push(name) });
    return group;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// The structural paths three.js takes, each of which must invalidate the
// memoised walk. The walk itself is covered by @mvtjs/pixi's tests and the
// conformance suite.
describe('@mvtjs/three scene passes', () => {
    it('runs every method in a subtree, parents first, and updates with the time', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const child = recorded('child', calls);
        root.add(child);
        child.add(recorded('grandchild', calls));
        const deltas: number[] = [];
        setTickMethods(child, { update: (deltaMs) => void deltas.push(deltaMs) });

        tickScene({ root, only: 'refresh' });
        tickScene({ root, deltaMs: 16, only: 'update' });

        expect(calls).toEqual(['root', 'child', 'grandchild']);
        expect(deltas).toEqual([16]);
    });

    it('follows add, remove and clear after the walk was first built', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        tickScene({ root, only: 'refresh' });

        const a = recorded('a', calls);
        const b = recorded('b', calls);
        root.add(a, b);
        calls.length = 0;
        tickScene({ root, only: 'refresh' });
        expect(calls).toEqual(['root', 'a', 'b']);

        root.remove(a);
        calls.length = 0;
        tickScene({ root, only: 'refresh' });
        expect(calls).toEqual(['root', 'b']);

        root.clear();
        calls.length = 0;
        tickScene({ root, only: 'refresh' });
        expect(calls).toEqual(['root']);
    });

    it('follows removeFromParent and reparenting on both sides', () => {
        const calls: string[] = [];
        const left = recorded('left', calls);
        const right = recorded('right', calls);
        const moving = recorded('moving', calls);
        left.add(moving);
        tickScene({ root: left, only: 'refresh' });
        tickScene({ root: right, only: 'refresh' });

        // `add` detaches from the old parent through `removeFromParent`
        right.add(moving);
        calls.length = 0;
        tickScene({ root: left, only: 'refresh' });
        tickScene({ root: right, only: 'refresh' });
        expect(calls).toEqual(['left', 'right', 'moving']);

        moving.removeFromParent();
        calls.length = 0;
        tickScene({ root: right, only: 'refresh' });
        expect(calls).toEqual(['right']);
    });

    it('follows attach, which does not go through add', () => {
        const calls: string[] = [];
        const from = recorded('from', calls);
        const to = recorded('to', calls);
        const moving = recorded('moving', calls);
        from.add(moving);
        tickScene({ root: from, only: 'refresh' });
        tickScene({ root: to, only: 'refresh' });

        to.attach(moving);
        calls.length = 0;
        tickScene({ root: from, only: 'refresh' });
        tickScene({ root: to, only: 'refresh' });

        expect(calls).toEqual(['from', 'to', 'moving']);
    });

    it('follows a method assigned after the walk was built', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const quiet: Object3D = new Group();
        root.add(quiet);
        tickScene({ root, only: 'refresh' });

        setTickMethods(quiet, { refresh: () => void calls.push('quiet') });
        calls.length = 0;
        tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['root', 'quiet']);
    });

    it('refreshes an object a method adds, in the same scene pass', () => {
        const calls: string[] = [];
        const root = new Group();
        setTickMethods(root, {
            refresh: () => {
                if (root.children.length === 0) root.add(recorded('added', calls));
            },
        });

        tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['added']);
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
            // A destroyed node ticked itself runs nothing
            calls.length = 0;
            tickScene({ root: doomed, only: 'refresh' });
            expect(calls).toEqual([]);
        });
    });
});

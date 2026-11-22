import { Container3D } from '@pixi/3d';
import { describe, expect, it } from 'vitest';
import { refreshView, setRefresh, setUpdate, updateView } from '@mvtjs/pixi';
import './container3d-mixin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A node whose refresh method records its label in `calls`. */
function recorded(label: string, calls: string[]): Container3D {
    const node = new Container3D({ label });
    setRefresh(node, () => void calls.push(label));
    return node;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Each way PixiJS 3D changes its tree must clear the cached method lists.
// The method lists themselves are covered by @mvtjs/utils' and @mvtjs/pixi's
// tests.
describe('updateView and refreshView on PixiJS 3D nodes', () => {
    it('runs every method in a subtree, parents first, and updates with the time', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const child = recorded('child', calls);
        root.addChild(child);
        child.addChild(recorded('grandchild', calls));
        const deltas: number[] = [];
        setUpdate(child, (deltaMs) => void deltas.push(deltaMs));

        refreshView(root);
        updateView(root, 16);

        expect(calls).toEqual(['root', 'child', 'grandchild']);
        expect(deltas).toEqual([16]);
    });

    it('follows addChild, addChildAt, removeChild and removeChildren after the walk was first built', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        refreshView(root);
        const a = recorded('a', calls);
        const b = recorded('b', calls);
        const c = recorded('c', calls);

        const refreshed = (): string[] => {
            calls.length = 0;
            refreshView(root);
            return [...calls];
        };

        root.addChild(a, b);
        expect(refreshed()).toEqual(['root', 'a', 'b']);
        root.addChildAt(c, 0);
        expect(refreshed()).toEqual(['root', 'c', 'a', 'b']);
        root.removeChild(a);
        expect(refreshed()).toEqual(['root', 'c', 'b']);
        root.removeChildren();
        expect(refreshed()).toEqual(['root']);
    });

    it('follows a node moving between parents, on both sides', () => {
        const calls: string[] = [];
        const left = recorded('left', calls);
        const right = recorded('right', calls);
        const moving = recorded('moving', calls);
        left.addChild(moving);
        refreshView(left);
        refreshView(right);

        right.addChild(moving);
        calls.length = 0;
        refreshView(left);
        refreshView(right);
        expect(calls).toEqual(['left', 'right', 'moving']);

        left.reparentChild(moving);
        calls.length = 0;
        refreshView(left);
        refreshView(right);
        expect(calls).toEqual(['left', 'moving', 'right']);
    });

    it('stops calling a node once it is destroyed', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        root.destroy();

        refreshView(root);

        expect(calls).toEqual([]);
    });
});

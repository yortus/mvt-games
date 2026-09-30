// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { destroyElement, isDestroyed, onDestroyed, refreshScene, updateScene } from './scene-passes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A `<div>` whose `onRefresh` records its id in `calls`. */
function recorded(id: string, calls: string[]): HTMLDivElement {
    const div = quiet(id);
    div.onRefresh = () => void calls.push(id);
    return div;
}

/** A `<div>` with no methods. */
function quiet(id: string): HTMLDivElement {
    const div = document.createElement('div');
    div.id = id;
    return div;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Nothing wraps the DOM's methods: every change below reaches the memoised
// walk through the `MutationObserver`, taken synchronously at the start of the
// next scene pass. The walk itself is covered by pixi-mvt's tests and the
// conformance suite.
describe('html-mvt scene passes', () => {
    it('runs every method in a subtree, parents first, and updates with the time', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const child = recorded('child', calls);
        root.append(child);
        child.append(recorded('grandchild', calls));
        const deltas: number[] = [];
        child.onUpdate = (deltaMs) => void deltas.push(deltaMs);

        refreshScene(root);
        updateScene(root, 16);

        expect(calls).toEqual(['root', 'child', 'grandchild']);
        expect(deltas).toEqual([16]);
    });

    it('follows changes made just before a scene pass, however they are made', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        refreshScene(root);
        const expectCalls = (expected: string[]): void => {
            calls.length = 0;
            refreshScene(root);
            expect(calls).toEqual(expected);
        };

        const a = recorded('a', calls);
        root.appendChild(a);
        expectCalls(['root', 'a']);

        root.insertBefore(recorded('b', calls), a);
        expectCalls(['root', 'b', 'a']);

        a.replaceWith(recorded('c', calls));
        expectCalls(['root', 'b', 'c']);

        root.replaceChildren(recorded('d', calls));
        expectCalls(['root', 'd']);

        // Markup makes elements with no methods; giving one a method still counts
        root.innerHTML = '<p id="e"><span id="f"></span></p>';
        expectCalls(['root']);
        root.querySelector('#f')!.onRefresh = () => void calls.push('f');
        expectCalls(['root', 'f']);

        root.firstElementChild!.remove();
        expectCalls(['root']);
    });

    it('follows a change deep inside the subtree', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const middle = quiet('middle');
        const inner = quiet('inner');
        root.append(middle);
        middle.append(inner);
        refreshScene(root);

        inner.append(recorded('deep', calls));
        calls.length = 0;
        refreshScene(root);

        expect(calls).toEqual(['root', 'deep']);
    });

    it('follows reparenting on both sides', () => {
        const calls: string[] = [];
        const left = recorded('left', calls);
        const right = recorded('right', calls);
        const moving = recorded('moving', calls);
        left.append(moving);
        refreshScene(left);
        refreshScene(right);

        right.append(moving);
        calls.length = 0;
        refreshScene(left);
        refreshScene(right);

        expect(calls).toEqual(['left', 'right', 'moving']);
    });

    it('follows a change made inside a subtree while it was detached', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const branch = quiet('branch');
        root.append(branch);
        // The walk now knows `branch` holds no methods
        refreshScene(root);

        branch.remove();
        // Lets the removal be processed. Browsers need no scene pass here, as
        // their transient observers report changes to a just-removed element,
        // but happy-dom has none.
        refreshScene(root);
        branch.append(recorded('late', calls));
        root.append(branch);
        calls.length = 0;
        refreshScene(root);

        expect(calls).toEqual(['root', 'late']);
    });

    it('ignores text changes, which never touch the walk', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        root.append(recorded('child', calls));
        refreshScene(root);
        const walk = root._mvtRefresh;

        root.append(document.createTextNode('hello'));
        (root.lastChild as Text).data = 'changed';
        refreshScene(root);

        expect(root._mvtRefresh).toBe(walk);
    });

    it('follows a method assigned after the walk was built', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const later = quiet('later');
        root.append(later);
        refreshScene(root);

        later.onRefresh = () => void calls.push('later');
        calls.length = 0;
        refreshScene(root);

        expect(calls).toEqual(['root', 'later']);
    });

    it('skips an element removed by a method earlier in the same scene pass', () => {
        const calls: string[] = [];
        const root = quiet('root');
        const doomed = recorded('doomed', calls);
        let shouldRemove = false;
        root.onRefresh = () => {
            if (shouldRemove) doomed.remove();
        };
        root.append(doomed);
        refreshScene(root);
        expect(calls).toEqual(['doomed']);

        shouldRemove = true;
        calls.length = 0;
        refreshScene(root);

        expect(calls).toEqual([]);
    });

    describe('destroyElement', () => {
        it('runs onDestroyed callbacks parent first, once, then removes and silences the subtree', () => {
            const calls: string[] = [];
            const root = recorded('root', calls);
            const doomed = recorded('doomed', calls);
            const inner = recorded('inner', calls);
            root.append(doomed);
            doomed.append(inner);
            const destroyed: string[] = [];
            onDestroyed(doomed, (node) => void destroyed.push(node.id));
            onDestroyed(inner, (node) => void destroyed.push(node.id));

            destroyElement(doomed);
            destroyElement(doomed);

            expect(destroyed).toEqual(['doomed', 'inner']);
            expect(doomed.parentNode).toBeNull();
            expect(isDestroyed(inner)).toBe(true);
            // A destroyed element passed to refreshScene itself runs nothing
            calls.length = 0;
            refreshScene(doomed);
            expect(calls).toEqual([]);
        });
    });
});

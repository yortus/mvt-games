// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView, setRefresh, setUpdate, updateView } from '@mvtjs/utils';
import { destroyElement, isDestroyed, onDestroyed } from './element-mixin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A `<div>` whose refresh method records its id in `calls`. */
function recorded(id: string, calls: string[]): HTMLDivElement {
    const div = quiet(id);
    setRefresh(div, () => void calls.push(id));
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

// Nothing wraps the DOM's methods: every change below reaches the cached
// method lists through the `MutationObserver`, taken synchronously at the
// start of the next `updateView` or `refreshView`. The method lists
// themselves are covered by @mvtjs/utils' and @mvtjs/pixi's tests and the
// conformance suite.
describe('updateView and refreshView on DOM elements', () => {
    it('runs every method in a subtree, parents first, and updates with the time', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const child = recorded('child', calls);
        root.append(child);
        child.append(recorded('grandchild', calls));
        const deltas: number[] = [];
        setUpdate(child, (deltaMs) => void deltas.push(deltaMs));

        refreshView(root);
        updateView(root, 16);

        expect(calls).toEqual(['root', 'child', 'grandchild']);
        expect(deltas).toEqual([16]);
    });

    it('follows changes made just before a call, however they are made', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        refreshView(root);
        const expectCalls = (expected: string[]): void => {
            calls.length = 0;
            refreshView(root);
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
        setRefresh(root.querySelector('#f')!, () => void calls.push('f'));
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
        refreshView(root);

        inner.append(recorded('deep', calls));
        calls.length = 0;
        refreshView(root);

        expect(calls).toEqual(['root', 'deep']);
    });

    it('follows reparenting on both sides', () => {
        const calls: string[] = [];
        const left = recorded('left', calls);
        const right = recorded('right', calls);
        const moving = recorded('moving', calls);
        left.append(moving);
        refreshView(left);
        refreshView(right);

        right.append(moving);
        calls.length = 0;
        refreshView(left);
        refreshView(right);

        expect(calls).toEqual(['left', 'right', 'moving']);
    });

    it('follows a change made inside a subtree while it was detached', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const branch = quiet('branch');
        root.append(branch);
        // The method list now knows `branch` holds no methods
        refreshView(root);

        branch.remove();
        // Lets the removal be processed. Browsers need no call here, as
        // their transient observers report changes to a just-removed element,
        // but happy-dom has none.
        refreshView(root);
        branch.append(recorded('late', calls));
        root.append(branch);
        calls.length = 0;
        refreshView(root);

        expect(calls).toEqual(['root', 'late']);
    });

    it('ignores text changes, which never clear the method list', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        root.append(recorded('child', calls));
        refreshView(root);
        const list = refreshMethodListOf(root);

        root.append(document.createTextNode('hello'));
        (root.lastChild as Text).data = 'changed';
        refreshView(root);

        expect(list).toBeDefined();
        expect(refreshMethodListOf(root)).toBe(list);
    });

    it('follows a method assigned after the method list was built', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const later = quiet('later');
        root.append(later);
        refreshView(root);

        setRefresh(later, () => void calls.push('later'));
        calls.length = 0;
        refreshView(root);

        expect(calls).toEqual(['root', 'later']);
    });

    it('skips an element removed by a method earlier in the same call', () => {
        const calls: string[] = [];
        const root = quiet('root');
        const doomed = recorded('doomed', calls);
        let shouldRemove = false;
        setRefresh(root, () => {
            if (shouldRemove) doomed.remove();
        });
        root.append(doomed);
        refreshView(root);
        expect(calls).toEqual(['doomed']);

        shouldRemove = true;
        calls.length = 0;
        refreshView(root);

        expect(calls).toEqual([]);
    });

    it('refreshes an element a method appends, in the same call', () => {
        // Heard of through the observer, which `refreshView` asks again once
        // it has invoked its method list.
        const calls: string[] = [];
        const root = quiet('root');
        setRefresh(root, () => {
            if (root.childElementCount === 0) root.append(recorded('added', calls));
        });

        refreshView(root);

        expect(calls).toEqual(['added']);
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
            // A destroyed element ticked itself runs nothing
            calls.length = 0;
            refreshView(doomed);
            expect(calls).toEqual([]);
        });
    });
});

/** The node's cached refresh method list, read off its private field. */
function refreshMethodListOf(node: Element): unknown {
    return (node as unknown as { _mvtRefreshMethodList?: unknown })._mvtRefreshMethodList;
}

// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { destroyElement, isDestroyed, onDestroyed, setTickMethods, tickScene } from './element-mixin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A `<div>` whose refresh method records its id in `calls`. */
function recorded(id: string, calls: string[]): HTMLDivElement {
    const div = quiet(id);
    setTickMethods(div, { refresh: () => void calls.push(id) });
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
// next scene pass. The walk itself is covered by @mvtjs/pixi's tests and the
// conformance suite.
describe('@mvtjs/html scene passes', () => {
    it('runs every method in a subtree, parents first, and updates with the time', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const child = recorded('child', calls);
        root.append(child);
        child.append(recorded('grandchild', calls));
        const deltas: number[] = [];
        setTickMethods(child, { update: (deltaMs) => void deltas.push(deltaMs) });

        tickScene({ root, only: 'refresh' });
        tickScene({ root, deltaMs: 16, only: 'update' });

        expect(calls).toEqual(['root', 'child', 'grandchild']);
        expect(deltas).toEqual([16]);
    });

    it('follows changes made just before a scene pass, however they are made', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        tickScene({ root, only: 'refresh' });
        const expectCalls = (expected: string[]): void => {
            calls.length = 0;
            tickScene({ root, only: 'refresh' });
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
        setTickMethods(root.querySelector('#f')!, { refresh: () => void calls.push('f') });
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
        tickScene({ root, only: 'refresh' });

        inner.append(recorded('deep', calls));
        calls.length = 0;
        tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['root', 'deep']);
    });

    it('follows reparenting on both sides', () => {
        const calls: string[] = [];
        const left = recorded('left', calls);
        const right = recorded('right', calls);
        const moving = recorded('moving', calls);
        left.append(moving);
        tickScene({ root: left, only: 'refresh' });
        tickScene({ root: right, only: 'refresh' });

        right.append(moving);
        calls.length = 0;
        tickScene({ root: left, only: 'refresh' });
        tickScene({ root: right, only: 'refresh' });

        expect(calls).toEqual(['left', 'right', 'moving']);
    });

    it('follows a change made inside a subtree while it was detached', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const branch = quiet('branch');
        root.append(branch);
        // The walk now knows `branch` holds no methods
        tickScene({ root, only: 'refresh' });

        branch.remove();
        // Lets the removal be processed. Browsers need no scene pass here, as
        // their transient observers report changes to a just-removed element,
        // but happy-dom has none.
        tickScene({ root, only: 'refresh' });
        branch.append(recorded('late', calls));
        root.append(branch);
        calls.length = 0;
        tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['root', 'late']);
    });

    it('ignores text changes, which never touch the walk', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        root.append(recorded('child', calls));
        tickScene({ root, only: 'refresh' });
        const walk = refreshWalkOf(root);

        root.append(document.createTextNode('hello'));
        (root.lastChild as Text).data = 'changed';
        tickScene({ root, only: 'refresh' });

        expect(walk).toBeDefined();
        expect(refreshWalkOf(root)).toBe(walk);
    });

    it('follows a method assigned after the walk was built', () => {
        const calls: string[] = [];
        const root = recorded('root', calls);
        const later = quiet('later');
        root.append(later);
        tickScene({ root, only: 'refresh' });

        setTickMethods(later, { refresh: () => void calls.push('later') });
        calls.length = 0;
        tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['root', 'later']);
    });

    it('skips an element removed by a method earlier in the same scene pass', () => {
        const calls: string[] = [];
        const root = quiet('root');
        const doomed = recorded('doomed', calls);
        let shouldRemove = false;
        setTickMethods(root, {
            refresh: () => {
                if (shouldRemove) doomed.remove();
            },
        });
        root.append(doomed);
        tickScene({ root, only: 'refresh' });
        expect(calls).toEqual(['doomed']);

        shouldRemove = true;
        calls.length = 0;
        tickScene({ root, only: 'refresh' });

        expect(calls).toEqual([]);
    });

    it('refreshes an element a method appends, in the same scene pass', () => {
        // Heard of through the observer, which the scene pass asks again once
        // its walk is done.
        const calls: string[] = [];
        const root = quiet('root');
        setTickMethods(root, {
            refresh: () => {
                if (root.childElementCount === 0) root.append(recorded('added', calls));
            },
        });

        tickScene({ root, only: 'refresh' });

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
            tickScene({ root: doomed, only: 'refresh' });
            expect(calls).toEqual([]);
        });
    });
});

/** The node's memoised refresh walk, read off its private field. */
function refreshWalkOf(node: Element): unknown {
    return (node as unknown as { _mvtRefreshWalk?: unknown })._mvtRefreshWalk;
}

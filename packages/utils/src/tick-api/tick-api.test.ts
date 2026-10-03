import { describe, expect, it, vi } from 'vitest';
import { PROTOCOL } from '../copies';
import { SKIP_DESCENDANTS } from './skip-descendants';
import { hasRefresh, hasUpdate, refreshView, registerRenderer, setRefresh, setUpdate, updateView } from './tick-api';

// ---------------------------------------------------------------------------
// A renderer of plain objects
// ---------------------------------------------------------------------------

// The renderer packages test `updateView` and `refreshView` on Pixi, three.js
// and the DOM. These tests use the smallest renderer there is: plain objects
// that inherit from one registered prototype.

interface TestNode {
    readonly label: string;
    readonly children: TestNode[];
    parent: TestNode | undefined;
}

declare module './renderer-views' {
    interface RendererViews {
        tickApiTest: TestNode;
    }
}

const testNodePrototype = {} as TestNode;

const { invalidate } = registerRenderer<TestNode>({
    prototype: testNodePrototype,
    children: (node) => node.children,
    parent: (node) => node.parent,
    describe: (node) => node.label,
});

function plainNode(label: string): TestNode {
    const node = Object.create(testNodePrototype) as { -readonly [K in keyof TestNode]: TestNode[K] };
    node.label = label;
    node.children = [];
    node.parent = undefined;
    return node;
}

/** Attaches `child`, and tells the renderer, as a renderer's code would. */
function append(parent: TestNode, child: TestNode): void {
    parent.children.push(child);
    child.parent = parent;
    invalidate(parent);
}

function detach(child: TestNode): void {
    const parent = child.parent;
    if (parent === undefined) return;
    parent.children.splice(parent.children.indexOf(child), 1);
    child.parent = undefined;
    invalidate(parent);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('setUpdate and setRefresh on a renderer\'s nodes', () => {
    it('set the methods updateView and refreshView call', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setUpdate(root, (deltaMs) => void calls.push(`update ${deltaMs}`));
        setRefresh(root, () => void calls.push('refresh'));

        updateView(root, 16);
        refreshView(root);

        expect(calls).toEqual(['update 16', 'refresh']);
    });

    it('includes a method set on a node after its walk was built', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('root'));
        refreshView(root);
        calls.length = 0;

        setRefresh(child, () => void calls.push('child'));
        refreshView(root);

        expect(calls).toEqual(['root', 'child']);
    });

    it('includes a method set on a deep descendant after its walk was built', () => {
        const root = plainNode('root');
        const middle = plainNode('middle');
        const leaf = plainNode('leaf');
        append(root, middle);
        append(middle, leaf);
        const calls: string[] = [];
        setUpdate(root, () => void calls.push('root'));
        updateView(root, 16);
        calls.length = 0;

        setUpdate(leaf, () => void calls.push('leaf'));
        updateView(root, 16);

        expect(calls).toEqual(['root', 'leaf']);
    });

    it('includes a node given a method before it was attached', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('root'));
        refreshView(root);
        calls.length = 0;

        const late = plainNode('late');
        setRefresh(late, () => void calls.push('late'));
        append(root, late);
        refreshView(root);

        expect(calls).toEqual(['root', 'late']);
    });

    it('stops calling a method cleared with undefined', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setRefresh(child, () => void calls.push('child'));
        refreshView(root);
        calls.length = 0;

        setRefresh(child, undefined);
        refreshView(root);

        expect(calls).toEqual([]);
    });

    it('stops calling a detached node', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setRefresh(child, () => void calls.push('child'));
        refreshView(root);
        calls.length = 0;

        detach(child);
        refreshView(root);

        expect(calls).toEqual([]);
    });

    it('honours SKIP_DESCENDANTS from a method set this way', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setRefresh(root, () => {
            calls.push('root');
            return SKIP_DESCENDANTS;
        });
        setRefresh(child, () => void calls.push('child'));

        refreshView(root);

        expect(calls).toEqual(['root']);
    });
});

describe('wrapping', () => {
    it('replaces a method when the new one declares no parameter, and never calls the old one', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('old'));
        setRefresh(root, () => void calls.push('new'));

        refreshView(root);

        expect(calls).toEqual(['new']);
    });

    it('gives a method that declares a parameter the one it replaces', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('own'));
        setRefresh(root, (own) => {
            calls.push('before');
            own?.();
            calls.push('after');
        });

        refreshView(root);

        expect(calls).toEqual(['before', 'own', 'after']);
    });

    it('gives it undefined when there was none', () => {
        const root = plainNode('root');
        let received: unknown = 'not called';
        setRefresh(root, (own) => {
            received = own;
        });

        refreshView(root);

        expect(received).toBeUndefined();
    });

    it('stacks wraps, the last one set running first', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('own'));
        setRefresh(root, (inner) => {
            calls.push('first wrap');
            return inner?.();
        });
        setRefresh(root, (inner) => {
            calls.push('second wrap');
            return inner?.();
        });

        refreshView(root);

        expect(calls).toEqual(['second wrap', 'first wrap', 'own']);
    });

    it('passes on SKIP_DESCENDANTS from the wrapped method when the wrapper returns its result', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setRefresh(child, () => void calls.push('child'));
        setRefresh(root, () => SKIP_DESCENDANTS);
        setRefresh(root, (own) => own?.());

        refreshView(root);

        expect(calls).toEqual([]);
    });

    it('removes the whole chain when the method is cleared', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('own'));
        setRefresh(root, (own) => own?.());
        setRefresh(root, undefined);

        refreshView(root);

        expect(calls).toEqual([]);
        expect(hasRefresh(root)).toBe(false);
    });

    it('replaces when the parameter has a default value, which the declared length does not count', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('own'));
        setRefresh(root, (own: (() => void) | undefined = undefined) => {
            calls.push(own === undefined ? 'replaced' : 'wrapped');
        });

        refreshView(root);

        expect(calls).toEqual(['replaced']);
    });

    it('gives an update method that declares a second parameter the one it replaces, with deltaMs', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setUpdate(root, (deltaMs) => void calls.push(`own ${deltaMs}`));
        setUpdate(root, (deltaMs, own) => {
            calls.push(`wrap ${deltaMs}`);
            own?.(deltaMs * 2);
        });

        updateView(root, 16);

        expect(calls).toEqual(['wrap 16', 'own 32']);
    });

    it('replaces an update method when the new one declares only deltaMs', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setUpdate(root, () => void calls.push('old'));
        setUpdate(root, (deltaMs) => void calls.push(`new ${deltaMs}`));

        updateView(root, 16);

        expect(calls).toEqual(['new 16']);
    });
});

describe('hasUpdate / hasRefresh', () => {
    it('are false for a node that was never given a method', () => {
        const node = plainNode('node');

        expect(hasUpdate(node)).toBe(false);
        expect(hasRefresh(node)).toBe(false);
    });

    it('are true once a method is set, and false once it is cleared', () => {
        const node = plainNode('node');
        setUpdate(node, () => {});
        setRefresh(node, () => {});

        expect(hasUpdate(node)).toBe(true);
        expect(hasRefresh(node)).toBe(true);

        setUpdate(node, undefined);
        setRefresh(node, undefined);

        expect(hasUpdate(node)).toBe(false);
        expect(hasRefresh(node)).toBe(false);
    });
});

describe('updateView and refreshView', () => {
    it('call every update method, then every refresh method, parents first', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setUpdate(root, (deltaMs) => void calls.push(`update root ${deltaMs}`));
        setRefresh(root, () => void calls.push('refresh root'));
        setUpdate(child, (deltaMs) => void calls.push(`update child ${deltaMs}`));
        setRefresh(child, () => void calls.push('refresh child'));

        updateView(root, 16);
        refreshView(root);

        expect(calls).toEqual(['update root 16', 'update child 16', 'refresh root', 'refresh child']);
    });

    it('updates without refreshing, and refreshes without updating', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setUpdate(root, () => void calls.push('update'));
        setRefresh(root, () => void calls.push('refresh'));

        updateView(root, 16);
        updateView(root, 16);
        refreshView(root);

        expect(calls).toEqual(['update', 'update', 'refresh']);
    });

    it('leaves out of updateView a subtree whose root returns SKIP_DESCENDANTS, and still refreshes it', () => {
        const root = plainNode('root');
        const game = plainNode('game');
        append(root, game);
        const calls: string[] = [];
        let isPaused = true;
        setUpdate(root, () => (isPaused ? SKIP_DESCENDANTS : undefined));
        setUpdate(game, () => void calls.push('update game'));
        setRefresh(game, () => void calls.push('refresh game'));

        updateView(root, 16);
        refreshView(root);
        isPaused = false;
        updateView(root, 16);
        refreshView(root);

        expect(calls).toEqual(['refresh game', 'update game', 'refresh game']);
    });

    it('accepts a negative deltaMs, for time run backwards', () => {
        const root = plainNode('root');
        const deltas: number[] = [];
        setUpdate(root, (deltaMs) => void deltas.push(deltaMs));

        updateView(root, -16);
        refreshView(root);
        updateView(root, 0);

        expect(deltas).toEqual([-16, 0]);
    });

    it.runIf(import.meta.env.DEV)('throws in dev when deltaMs is not a finite number', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setUpdate(root, () => void calls.push('update'));
        setRefresh(root, () => void calls.push('refresh'));

        expect(() => updateView(root, Number.NaN)).toThrow(/updateView\(\) on root was given deltaMs NaN/);
        expect(() => updateView(root, Infinity)).toThrow(/deltaMs Infinity/);
        // A caller without type checks can leave it out
        expect(() => (updateView as (view: TestNode) => void)(root)).toThrow(/deltaMs undefined/);
        expect(calls).toEqual([]);
    });

    it('throws for a value that is not a view of any installed renderer', () => {
        const stranger = { label: 'stranger', children: [], parent: undefined } as TestNode;
        const asUntyped = refreshView as (view: unknown) => void;

        expect(() => refreshView(stranger)).toThrow(
            /^\[mvt\] refreshView\(\) was given a plain object, which is not a view of any installed renderer/,
        );
        expect(() => updateView(stranger, 16)).toThrow(/^\[mvt\] updateView\(\) was given a plain object/);
        expect(() => asUntyped(new Map())).toThrow(/was given an object of class Map,/);
        expect(() => asUntyped(undefined)).toThrow(/was given undefined,/);
        // What a caller outside TypeScript may pass
        expect(() => asUntyped(null)).toThrow(/was given null,/);
    });

    it('throws when a method calls it on the view it is already inside', () => {
        const root = plainNode('root');
        setRefresh(root, () => refreshView(root));

        expect(() => refreshView(root)).toThrow(/refreshView\(\) was called on root from inside a method it called/);
    });

    it('lets a method update or refresh a different subtree', () => {
        const root = plainNode('root');
        const other = plainNode('other');
        const calls: string[] = [];
        setRefresh(other, () => void calls.push('other'));
        setRefresh(root, () => refreshView(other));

        refreshView(root);

        expect(calls).toEqual(['other']);
    });
});

describe('setUpdate and setRefresh', () => {
    it('set the two methods independently', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setUpdate(root, () => void calls.push('update'));
        setRefresh(root, () => void calls.push('refresh'));
        setRefresh(root, undefined);

        updateView(root, 16);
        refreshView(root);

        expect(calls).toEqual(['update']);
        expect(hasUpdate(root)).toBe(true);
        expect(hasRefresh(root)).toBe(false);
    });

    it('wrap independently', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setUpdate(root, (deltaMs) => void calls.push(`own update ${deltaMs}`));
        setRefresh(root, () => void calls.push('own refresh'));
        setUpdate(root, (deltaMs, own) => {
            calls.push('wrapped update');
            own?.(deltaMs);
        });
        setRefresh(root, (own) => {
            calls.push('wrapped refresh');
            own?.();
        });

        updateView(root, 16);
        refreshView(root);

        expect(calls).toEqual(['wrapped update', 'own update 16', 'wrapped refresh', 'own refresh']);
    });
});

describe('registerRenderer', () => {
    it('throws when a prototype is registered twice', () => {
        expect(() => registerRenderer<TestNode>({
            prototype: testNodePrototype,
            children: (node) => node.children,
            parent: (node) => node.parent,
            describe: (node) => node.label,
        })).toThrow(/already registered as a renderer's prototype/);
    });

    it('calls flushChanges before reading the tree, and again when a refresh ends', () => {
        const flushed: string[] = [];
        const prototype = {} as TestNode;
        registerRenderer<TestNode>({
            prototype,
            children: (node) => node.children,
            parent: (node) => node.parent,
            describe: (node) => node.label,
            flushChanges: (node) => void flushed.push(node.label),
        });
        const root = Object.assign(Object.create(prototype) as TestNode, { label: 'root', children: [], parent: undefined });

        updateView(root, 16);
        refreshView(root);

        expect(flushed).toEqual(['root', 'root', 'root']);
    });
});

describe('nodes set up by an incompatible copy', () => {
    it.runIf(import.meta.env.DEV)('marks a node with its protocol when its methods are set, in dev', () => {
        const node = plainNode('marked');
        setRefresh(node, () => undefined);
        expect((node as { _mvtProtocol?: number })._mvtProtocol).toBe(PROTOCOL);
    });

    it.runIf(import.meta.env.DEV)('warns once, in dev, of a node whose methods another protocol set', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const root = plainNode('root');
            const foreign = plainNode('foreign');
            const another = plainNode('another');
            append(root, foreign);
            append(root, another);
            // As a copy of another protocol would leave it: its own fields, under other names
            (foreign as { _mvtProtocol?: number })._mvtProtocol = PROTOCOL + 1;
            (another as { _mvtProtocol?: number })._mvtProtocol = PROTOCOL + 1;

            updateView(root, 16);
            refreshView(root);
            updateView(root, 16);
            refreshView(root);

            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toMatch(/^\[mvt\] (foreign|another) was set up by an incompatible copy of @mvtjs/);
        }
        finally {
            warn.mockRestore();
        }
    });
});

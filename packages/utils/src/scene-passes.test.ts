import { describe, expect, it } from 'vitest';
import { createScenePasses, hasRefresh, hasUpdate, setTickMethods } from './scene-passes';
import { SKIP_DESCENDANTS } from './skip-descendants';

// ---------------------------------------------------------------------------
// A tree of plain objects
// ---------------------------------------------------------------------------

// The renderer mixins test the scene passes on Pixi, three.js and the DOM,
// whose prototypes carry the scene passes' field defaults. These tests cover
// the other case: nodes with no defaults, which a walk gives the invalidation
// climbs itself, so that setting a method later still reaches the walks above.

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

/** Attaches `child`, and tells the scene passes, as a renderer's code would. */
function append(parent: PlainNode, child: PlainNode): void {
    parent.children.push(child);
    child.parent = parent;
    passes.invalidate(parent);
}

function detach(child: PlainNode): void {
    const parent = child.parent;
    if (parent === undefined) return;
    parent.children.splice(parent.children.indexOf(child), 1);
    child.parent = undefined;
    passes.invalidate(parent);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('setTickMethods on plain objects', () => {
    it('sets the methods the scene passes call', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { update: (deltaMs) => void calls.push(`update ${deltaMs}`) });
        setTickMethods(root, { refresh: () => void calls.push('refresh') });

        passes.tickScene({ root, deltaMs: 16 });

        expect(calls).toEqual(['update 16', 'refresh']);
    });

    it('includes a method set on a node after its walk was built', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setTickMethods(root, { refresh: () => void calls.push('root') });
        passes.tickScene({ root, only: 'refresh' });
        calls.length = 0;

        setTickMethods(child, { refresh: () => void calls.push('child') });
        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['root', 'child']);
    });

    it('includes a method set on a deep descendant after its walk was built', () => {
        const root = plainNode('root');
        const middle = plainNode('middle');
        const leaf = plainNode('leaf');
        append(root, middle);
        append(middle, leaf);
        const calls: string[] = [];
        setTickMethods(root, { update: () => void calls.push('root') });
        passes.tickScene({ root, deltaMs: 16, only: 'update' });
        calls.length = 0;

        setTickMethods(leaf, { update: () => void calls.push('leaf') });
        passes.tickScene({ root, deltaMs: 16, only: 'update' });

        expect(calls).toEqual(['root', 'leaf']);
    });

    it('includes a node given a method before it was attached', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { refresh: () => void calls.push('root') });
        passes.tickScene({ root, only: 'refresh' });
        calls.length = 0;

        const late = plainNode('late');
        setTickMethods(late, { refresh: () => void calls.push('late') });
        append(root, late);
        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['root', 'late']);
    });

    it('stops calling a method cleared with undefined', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setTickMethods(child, { refresh: () => void calls.push('child') });
        passes.tickScene({ root, only: 'refresh' });
        calls.length = 0;

        setTickMethods(child, { refresh: undefined });
        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual([]);
    });

    it('stops calling a detached node', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setTickMethods(child, { refresh: () => void calls.push('child') });
        passes.tickScene({ root, only: 'refresh' });
        calls.length = 0;

        detach(child);
        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual([]);
    });

    it('honours SKIP_DESCENDANTS from a method set this way', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setTickMethods(root, {
            refresh: () => {
                calls.push('root');
                return SKIP_DESCENDANTS;
            },
        });
        setTickMethods(child, { refresh: () => void calls.push('child') });

        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['root']);
    });
});

describe('wrapping with setTickMethods', () => {
    it('replaces a method when the new one declares no parameter, and never calls the old one', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { refresh: () => void calls.push('old') });
        setTickMethods(root, { refresh: () => void calls.push('new') });

        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['new']);
    });

    it('gives a method that declares a parameter the one it replaces', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { refresh: () => void calls.push('own') });
        setTickMethods(root, {
            refresh: (own) => {
                calls.push('before');
                own?.();
                calls.push('after');
            },
        });

        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['before', 'own', 'after']);
    });

    it('gives it undefined when there was none', () => {
        const root = plainNode('root');
        let received: unknown = 'not called';
        setTickMethods(root, {
            refresh: (own) => {
                received = own;
            },
        });

        passes.tickScene({ root, only: 'refresh' });

        expect(received).toBeUndefined();
    });

    it('stacks wraps, the last one set running first', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { refresh: () => void calls.push('own') });
        setTickMethods(root, {
            refresh: (inner) => {
                calls.push('first wrap');
                return inner?.();
            },
        });
        setTickMethods(root, {
            refresh: (inner) => {
                calls.push('second wrap');
                return inner?.();
            },
        });

        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['second wrap', 'first wrap', 'own']);
    });

    it('passes on SKIP_DESCENDANTS from the wrapped method when the wrapper returns its result', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setTickMethods(child, { refresh: () => void calls.push('child') });
        setTickMethods(root, { refresh: () => SKIP_DESCENDANTS });
        setTickMethods(root, { refresh: (own) => own?.() });

        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual([]);
    });

    it('removes the whole chain when the method is cleared', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { refresh: () => void calls.push('own') });
        setTickMethods(root, { refresh: (own) => own?.() });
        setTickMethods(root, { refresh: undefined });

        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual([]);
        expect(hasRefresh(root)).toBe(false);
    });

    it('replaces when the parameter has a default value, which the declared length does not count', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { refresh: () => void calls.push('own') });
        setTickMethods(root, {
            refresh: (own: (() => void) | undefined = undefined) => {
                calls.push(own === undefined ? 'replaced' : 'wrapped');
            },
        });

        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['replaced']);
    });

    it('gives an update method that declares a second parameter the one it replaces, with deltaMs', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { update: (deltaMs) => void calls.push(`own ${deltaMs}`) });
        setTickMethods(root, {
            update: (deltaMs, own) => {
                calls.push(`wrap ${deltaMs}`);
                own?.(deltaMs * 2);
            },
        });

        passes.tickScene({ root, deltaMs: 16, only: 'update' });

        expect(calls).toEqual(['wrap 16', 'own 32']);
    });

    it('replaces an update method when the new one declares only deltaMs', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { update: () => void calls.push('old') });
        setTickMethods(root, { update: (deltaMs) => void calls.push(`new ${deltaMs}`) });

        passes.tickScene({ root, deltaMs: 16, only: 'update' });

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
        setTickMethods(node, { update: () => {} });
        setTickMethods(node, { refresh: () => {} });

        expect(hasUpdate(node)).toBe(true);
        expect(hasRefresh(node)).toBe(true);

        setTickMethods(node, { update: undefined });
        setTickMethods(node, { refresh: undefined });

        expect(hasUpdate(node)).toBe(false);
        expect(hasRefresh(node)).toBe(false);
    });
});

describe('tickScene', () => {
    it('runs the whole update scene pass, then the whole refresh scene pass, parents first', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setTickMethods(root, {
            update: (deltaMs) => void calls.push(`update root ${deltaMs}`),
            refresh: () => void calls.push('refresh root'),
        });
        setTickMethods(child, {
            update: (deltaMs) => void calls.push(`update child ${deltaMs}`),
            refresh: () => void calls.push('refresh child'),
        });

        passes.tickScene({ root, deltaMs: 16 });

        expect(calls).toEqual(['update root 16', 'update child 16', 'refresh root', 'refresh child']);
    });

    it('runs only the scene pass `only` names', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, {
            update: () => void calls.push('update'),
            refresh: () => void calls.push('refresh'),
        });

        passes.tickScene({ root, deltaMs: 16 });

        expect(calls).toEqual(['update', 'refresh']);
    });

    it('leaves out of the update scene pass a subtree whose root returns SKIP_DESCENDANTS, and still refreshes it', () => {
        const root = plainNode('root');
        const game = plainNode('game');
        append(root, game);
        const calls: string[] = [];
        let isPaused = true;
        setTickMethods(root, { update: () => (isPaused ? SKIP_DESCENDANTS : undefined) });
        setTickMethods(game, {
            update: () => void calls.push('update game'),
            refresh: () => void calls.push('refresh game'),
        });

        passes.tickScene({ root, deltaMs: 16 });
        isPaused = false;
        passes.tickScene({ root, deltaMs: 16 });

        expect(calls).toEqual(['refresh game', 'update game', 'refresh game']);
    });

    it('accepts a negative deltaMs, for time run backwards', () => {
        const root = plainNode('root');
        const deltas: number[] = [];
        setTickMethods(root, { update: (deltaMs) => void deltas.push(deltaMs) });

        passes.tickScene({ root, deltaMs: -16 });
        passes.tickScene({ root, deltaMs: 0, only: 'update' });

        expect(deltas).toEqual([-16, 0]);
    });

    it.runIf(import.meta.env.DEV)('throws in dev when deltaMs is not a finite number', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, {
            update: () => void calls.push('update'),
            refresh: () => void calls.push('refresh'),
        });

        expect(() => passes.tickScene({ root, deltaMs: Number.NaN })).toThrow(/deltaMs NaN/);
        expect(() => passes.tickScene({ root, deltaMs: Infinity, only: 'update' })).toThrow(/deltaMs Infinity/);
        // A caller without type checks can leave it out
        expect(() => passes.tickScene({ root } as unknown as { root: PlainNode; deltaMs: number })).toThrow(/deltaMs undefined/);
        expect(calls).toEqual([]);
    });

    it('takes no deltaMs for the refresh scene pass alone', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { refresh: () => void calls.push('refresh') });

        passes.tickScene({ root, only: 'refresh' });

        expect(calls).toEqual(['refresh']);
    });
});

describe('setTickMethods', () => {
    it('sets both methods at once', () => {
        const node = plainNode('node');
        setTickMethods(node, { update: () => {}, refresh: () => {} });

        expect(hasUpdate(node)).toBe(true);
        expect(hasRefresh(node)).toBe(true);
    });

    it('leaves a member it is not given as it is', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, { update: () => void calls.push('update') });
        setTickMethods(root, { refresh: () => void calls.push('refresh') });

        passes.tickScene({ root, deltaMs: 16 });

        expect(calls).toEqual(['update', 'refresh']);
    });

    it('clears a member given as undefined', () => {
        const node = plainNode('node');
        setTickMethods(node, { update: () => {}, refresh: () => {} });
        setTickMethods(node, { refresh: undefined });

        expect(hasUpdate(node)).toBe(true);
        expect(hasRefresh(node)).toBe(false);
    });

    it('wraps per member', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setTickMethods(root, {
            update: (deltaMs) => void calls.push(`own update ${deltaMs}`),
            refresh: () => void calls.push('own refresh'),
        });
        setTickMethods(root, {
            update: (deltaMs, own) => {
                calls.push('wrapped update');
                own?.(deltaMs);
            },
            refresh: (own) => {
                calls.push('wrapped refresh');
                own?.();
            },
        });

        passes.tickScene({ root, deltaMs: 16 });

        expect(calls).toEqual(['wrapped update', 'own update 16', 'wrapped refresh', 'own refresh']);
    });
});

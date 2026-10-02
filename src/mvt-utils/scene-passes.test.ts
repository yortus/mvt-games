import { describe, expect, it } from 'vitest';
import { createScenePasses, hasRefresh, hasUpdate, setRefresh, setUpdate } from './scene-passes';
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

describe('setUpdate / setRefresh on plain objects', () => {
    it('sets the methods the scene passes call', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setUpdate(root, (deltaMs) => void calls.push(`update ${deltaMs}`));
        setRefresh(root, () => void calls.push('refresh'));

        passes.updateScene(root, 16);
        passes.refreshScene(root);

        expect(calls).toEqual(['update 16', 'refresh']);
    });

    it('includes a method set on a node after its walk was built', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('root'));
        passes.refreshScene(root);
        calls.length = 0;

        setRefresh(child, () => void calls.push('child'));
        passes.refreshScene(root);

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
        passes.updateScene(root, 16);
        calls.length = 0;

        setUpdate(leaf, () => void calls.push('leaf'));
        passes.updateScene(root, 16);

        expect(calls).toEqual(['root', 'leaf']);
    });

    it('includes a node given a method before it was attached', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('root'));
        passes.refreshScene(root);
        calls.length = 0;

        const late = plainNode('late');
        setRefresh(late, () => void calls.push('late'));
        append(root, late);
        passes.refreshScene(root);

        expect(calls).toEqual(['root', 'late']);
    });

    it('stops calling a method cleared with undefined', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setRefresh(child, () => void calls.push('child'));
        passes.refreshScene(root);
        calls.length = 0;

        setRefresh(child, undefined);
        passes.refreshScene(root);

        expect(calls).toEqual([]);
    });

    it('stops calling a detached node', () => {
        const root = plainNode('root');
        const child = plainNode('child');
        append(root, child);
        const calls: string[] = [];
        setRefresh(child, () => void calls.push('child'));
        passes.refreshScene(root);
        calls.length = 0;

        detach(child);
        passes.refreshScene(root);

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

        passes.refreshScene(root);

        expect(calls).toEqual(['root']);
    });
});

describe('wrapping with setRefresh / setUpdate', () => {
    it('replaces a method when the new one declares no parameter, and never calls the old one', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('old'));
        setRefresh(root, () => void calls.push('new'));

        passes.refreshScene(root);

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

        passes.refreshScene(root);

        expect(calls).toEqual(['before', 'own', 'after']);
    });

    it('gives it undefined when there was none', () => {
        const root = plainNode('root');
        let received: unknown = 'not called';
        setRefresh(root, (own) => {
            received = own;
        });

        passes.refreshScene(root);

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

        passes.refreshScene(root);

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

        passes.refreshScene(root);

        expect(calls).toEqual([]);
    });

    it('removes the whole chain when the method is cleared', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setRefresh(root, () => void calls.push('own'));
        setRefresh(root, (own) => own?.());
        setRefresh(root, undefined);

        passes.refreshScene(root);

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

        passes.refreshScene(root);

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

        passes.updateScene(root, 16);

        expect(calls).toEqual(['wrap 16', 'own 32']);
    });

    it('replaces an update method when the new one declares only deltaMs', () => {
        const root = plainNode('root');
        const calls: string[] = [];
        setUpdate(root, () => void calls.push('old'));
        setUpdate(root, (deltaMs) => void calls.push(`new ${deltaMs}`));

        passes.updateScene(root, 16);

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

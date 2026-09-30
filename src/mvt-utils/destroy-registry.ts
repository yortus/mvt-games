import type { SceneNode } from './scene-node';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Destroying nodes, for a tree whose nodes have no destroy of their own (a
 * three.js `Object3D`, a DOM `Element`). Pixi has `destroy` and a
 * `'destroyed'` event, and needs none of this.
 */
export interface DestroyRegistry<N> {
    /**
     * Destroys `node` and its subtree: runs every `onDestroyed` callback in it,
     * a node's before its descendants', as Pixi does, clears each node's
     * `onUpdate` and `onRefresh` so no scene pass calls it again, then detaches
     * `node` from its parent. Destroying a node twice does nothing the second
     * time.
     */
    destroy: (node: N) => void;
    /** Runs `callback` when `node` is destroyed, by `destroy` on it or on an ancestor. */
    onDestroyed: (node: N, callback: (node: N) => void) => void;
    /** Whether `node` has been destroyed. */
    isDestroyed: (node: N) => boolean;
}

export interface DestroyRegistryOptions<N> {
    /** The node's children. Read when it is destroyed. */
    readonly children: (node: N) => ArrayLike<N>;
    /** Detaches `node` from its parent, if it has one. */
    readonly detach: (node: N) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDestroyRegistry<N extends SceneNode & object>(options: DestroyRegistryOptions<N>): DestroyRegistry<N> {
    const callbacks = new WeakMap<N, ((node: N) => void)[]>();
    const destroyed = new WeakSet<N>();

    return {
        destroy(node) {
            if (destroyed.has(node)) return;
            destroySubtree(node);
            options.detach(node);
        },
        onDestroyed(node, callback) {
            const list = callbacks.get(node);
            if (list === undefined) callbacks.set(node, [callback]);
            else list.push(callback);
        },
        isDestroyed: (node) => destroyed.has(node),
    };

    function destroySubtree(node: N): void {
        destroyed.add(node);
        // Cleared first, so the setters still climb through the ancestors
        node.onUpdate = undefined;
        node.onRefresh = undefined;
        const list = callbacks.get(node);
        if (list !== undefined) {
            callbacks.delete(node);
            for (let i = 0; i < list.length; i++) list[i](node);
        }
        // A copy: a callback may have changed the children
        const children = Array.from(options.children(node));
        for (let i = 0; i < children.length; i++) {
            if (!destroyed.has(children[i])) destroySubtree(children[i]);
        }
    }
}

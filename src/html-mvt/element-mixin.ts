import { createDestroyRegistry, createScenePasses } from '../mvt-utils';
import type { RefreshMethod, SubtreeInfo, UpdateMethod } from '../mvt-utils';

// ---------------------------------------------------------------------------
// Type Augmentation
// ---------------------------------------------------------------------------

declare global {
    interface Element {
        /**
         * Advances this element's cosmetic presentation state. Run by
         * `updateScene`, every tick, whether or not the element is shown.
         * Return `SKIP_DESCENDANTS` to freeze its descendants.
         */
        onUpdate: UpdateMethod | undefined;
        /**
         * Syncs this element from model state. Run by `refreshScene`, before
         * any of its descendants', whether or not it is shown. Must be
         * idempotent, and should only write: reading layout (`offsetWidth`,
         * `getBoundingClientRect`) after a write makes the browser lay the
         * page out there and then. Return `SKIP_DESCENDANTS` to skip its
         * descendants.
         */
        onRefresh: RefreshMethod | undefined;

        /** @internal Backing field for `onUpdate`. */
        _mvtOnUpdate: UpdateMethod | undefined;
        /** @internal Backing field for `onRefresh`. */
        _mvtOnRefresh: RefreshMethod | undefined;
        /** @internal Does this subtree hold any `onUpdate`? `undefined` = dirty. */
        _mvtHasUpdate: boolean | undefined;
        /** @internal Update walk for this subtree. `undefined` = dirty. */
        _mvtUpdate: SubtreeInfo<Element> | undefined;
        /** @internal Does this subtree hold any `onRefresh`? `undefined` = dirty. */
        _mvtHasRefresh: boolean | undefined;
        /** @internal Refresh walk for this subtree. `undefined` = dirty. */
        _mvtRefresh: SubtreeInfo<Element> | undefined;
    }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * The scene passes over DOM elements: the generic memoised walk
 * (`../mvt-utils`) over each element's element children. Text nodes
 * carry no methods and are never visited.
 *
 * Call {@link watchElementTree} on a node before each scene pass on it:
 * nothing here wraps the DOM's methods, so the walk hears about changes to
 * the tree only through it.
 */
export const elementScenePasses = createScenePasses<Element>({
    children: elementChildren,
    // Not `parentNode`: a node moved into a fragment has left the scene, and
    // is skipped like any other detached node.
    parent: (node) => node.parentElement,
    describe: (node) => (node.id ? `<${node.localName} id="${node.id}">` : `<${node.localName}>`),
});

/**
 * Destroying elements, which have no destroy of their own: runs each
 * `onDestroyed` callback in the subtree, stops the scene passes calling it,
 * and removes it from the page. Listeners on the elements go with them when
 * they are collected; listeners a view added to `window` or `document` are
 * what `onDestroyed` is for.
 */
export const elementDestroyRegistry = createDestroyRegistry<Element>({
    children: (node) => node.children,
    detach: (node) => {
        node.remove();
    },
});

/**
 * Makes sure the scene passes hear about every change to the element tree
 * under `node`, and catches up on the changes made since the last call.
 * Called at the start of every scene pass, on the node it starts from.
 *
 * The DOM has too many ways to change a tree to wrap them all (`append`,
 * `before`, `replaceChildren`, `innerHTML` and more), and wrapping any of
 * them would change them for every script on the page. Instead one
 * `MutationObserver` watches the subtree of each node a scene pass starts
 * from, and its records are taken here synchronously, with `takeRecords`, so
 * a change made just before a scene pass is seen by it. The observer's
 * callback handles records that arrive between scene passes the same way.
 *
 * An element that leaves a watched subtree is watched on its own from then
 * on, so a change made inside it while it is detached still clears its
 * memoised walk before it is attached and walked again. Until its removal is
 * processed, the DOM's transient observers cover it: the standard says a
 * removed node stays observed by its old ancestors' observers until their
 * records are delivered, and browsers do so. happy-dom does not, so there a
 * change made to a removed element before the next scene pass or microtask
 * can be missed.
 */
export function watchElementTree(node: Element): void {
    if (observer !== undefined) processRecords(observer.takeRecords());
    if (!watched.has(node)) watch(node);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ELEMENT_NODE = 1;

const NO_CHILDREN: readonly Element[] = [];

/**
 * An element's element children, as an array, for rebuilding a memoised walk.
 * Not `children`: indexing that live collection made rebuilds twice as slow
 * in Chrome as walking siblings into an array, and a leaf, most elements,
 * shares one empty array (the `html-scene-passes` benchmark, `churn`).
 */
function elementChildren(node: Element): readonly Element[] {
    let child = node.firstElementChild;
    if (child === null) return NO_CHILDREN;
    const children: Element[] = [];
    for (; child !== null; child = child.nextElementSibling) children.push(child);
    return children;
}

/** Nodes the observer watches, with their subtrees. */
const watched = new WeakSet<Node>();

/** Made on first use, so this module can load where there is no DOM. */
let observer: MutationObserver | undefined;

// Installed at module load, before any element can be given a method: one
// assigned before the accessors exist becomes an own property that shadows
// them, and loses every invalidation. Skipped where there is no DOM, such as
// in Node when the build-time precompiler reads the HTML element table.
if (typeof Element !== 'undefined') elementScenePasses.installMethods(Element.prototype);

function watch(node: Node): void {
    observer ??= new MutationObserver(processRecords);
    watched.add(node);
    // Element children only: text changes need no records, and the JSX `text`
    // attribute writes a text node's `data`, which queues none.
    observer.observe(node, { childList: true, subtree: true });
}

/**
 * Clears the memoised walks above every element whose element children
 * changed. Records that only add or remove text nodes are ignored: methods
 * live on elements.
 */
function processRecords(records: readonly MutationRecord[]): void {
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        let hasElement = false;
        const removed = record.removedNodes;
        for (let j = 0; j < removed.length; j++) {
            const node = removed[j];
            if (node.nodeType !== ELEMENT_NODE) continue;
            hasElement = true;
            if (!watched.has(node)) watch(node);
        }
        const added = record.addedNodes;
        for (let j = 0; j < added.length && !hasElement; j++) {
            if (added[j].nodeType === ELEMENT_NODE) hasElement = true;
        }
        if (hasElement && record.target.nodeType === ELEMENT_NODE) {
            elementScenePasses.invalidate(record.target as Element);
        }
    }
}

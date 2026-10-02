import { createDestroyRegistry, createScenePasses } from '../mvt-utils';

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * The scene passes over DOM elements: the generic memoised walk
 * (`ScenePasses` in `../mvt-utils`) over each element's element children.
 * Text nodes carry no methods and are never visited. They run for hidden
 * elements too. A refresh should only write: reading layout (`offsetWidth`,
 * `getBoundingClientRect`) after a write makes the browser lay the page out
 * there and then.
 *
 * Nothing here wraps the DOM's methods: the walk hears about changes to the
 * tree through {@link watchElementTree}, its `beforeScenePass`.
 */
const elementScenePasses = createScenePasses<Element>({
    children: elementChildren,
    // Not `parentNode`: a node moved into a fragment has left the scene, and
    // is skipped like any other detached node.
    parent: (node) => node.parentElement,
    describe: (node) => (node.id ? `<${node.localName} id="${node.id}">` : `<${node.localName}>`),
    beforeScenePass: watchElementTree,
});

/** The tick API, typed to this renderer's nodes (see `./index.ts`). */
export const { tickScene, setTickMethods } = elementScenePasses;

/**
 * Destroying elements, which have no destroy of their own
 * (`DestroyRegistry` in `../mvt-utils`): runs each
 * `onDestroyed` callback in the subtree, stops the scene passes calling it,
 * and removes it from the page. Listeners on the elements go with them when
 * they are collected; listeners a view added to `window` or `document` are
 * what `onDestroyed` is for.
 */
const elementDestroyRegistry = createDestroyRegistry<Element>({
    children: (node) => node.children,
    detach: (node) => {
        node.remove();
    },
});

export const { destroy: destroyElement, onDestroyed, isDestroyed } = elementDestroyRegistry;

/**
 * Makes sure the scene passes hear about every change to the element tree
 * under `node`, and catches up on the changes made since the last call.
 * The scene passes' `beforeScenePass`: called at the start of every scene
 * pass, on the node it starts from.
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
function watchElementTree(node: Element): void {
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

// Installed at module load, so every element carries the scene passes' field
// defaults before any is given a method or walked. Skipped where there is no
// DOM, such as in Node, where scripts and benchmarks may load the HTML element
// table.
if (typeof Element !== 'undefined') elementScenePasses.installFieldDefaults(Element.prototype);

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

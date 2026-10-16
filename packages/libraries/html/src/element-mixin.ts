import { createDestroyRegistry, type DestroyRegistry, type RegisteredRenderer, registerCopy, registerRenderer, shareAcrossCopies } from '@mvtjs/utils';
import { version } from '../package.json';

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

declare module '@mvtjs/utils' {
    interface RendererViews {
        /** DOM elements. */
        html: Element;
    }
}

/**
 * DOM elements, registered with `registerRenderer` on `Element.prototype` so
 * that `updateView` and `refreshView` walk them, with the destroy registry and
 * the tree observer for them (see `createElementCore`). Every copy of
 * @mvtjs/html in a page shares them, made by the first copy to load, so the
 * copies agree and one observer watches the page.
 *
 * Installed at module load, so every element carries the private fields'
 * defaults before any is given a method or walked. Every entry point of the
 * package imports this module, which also brings the `RendererViews`
 * declaration above with it. Where there is no DOM, such as in Node, where
 * scripts and benchmarks may load the HTML element table, nothing is
 * registered and the core is kept on `globalThis`.
 */
const elementCore = shareAcrossCopies(
    typeof Element === 'undefined' ? globalThis : Element.prototype,
    '@mvtjs/html',
    createElementCore,
);

export const { destroy: destroyElement, onDestroyed, isDestroyed } = elementCore.destroyRegistry;

registerCopy('@mvtjs/html', version);

/** What every copy of @mvtjs/html in a page shares. */
interface ElementCore {
    /**
     * Destroying elements, which have no destroy of their own
     * (`DestroyRegistry` in `@mvtjs/utils`): runs each
     * `onDestroyed` callback in the subtree, clears its update and refresh
     * methods, and removes it from the page. Listeners on the elements go with them when
     * they are collected; listeners a view added to `window` or `document` are
     * what `onDestroyed` is for.
     */
    readonly destroyRegistry: DestroyRegistry<Element>;
}

/**
 * Registers DOM elements: the generic method lists of `@mvtjs/utils` over
 * each element's element children. Text nodes carry no methods and are never
 * visited. They run for hidden elements too. A refresh should only write:
 * reading layout (`offsetWidth`, `getBoundingClientRect`) after a write makes
 * the browser lay the page out there and then.
 *
 * Nothing here wraps the DOM's methods: `updateView` and `refreshView` hear
 * about changes to the tree through `watchElementTree`, the registration's
 * `flushChanges`.
 */
function createElementCore(): ElementCore {
    /** Nodes the observer watches, with their subtrees. */
    const watched = new WeakSet<Node>();

    /** Made on first use, so this module can load where there is no DOM. */
    let observer: MutationObserver | undefined;

    const renderer = typeof Element === 'undefined' ? undefined : registerElements();

    const destroyRegistry = createDestroyRegistry<Element>({
        children: (node) => node.children,
        detach: (node) => {
            node.remove();
        },
    });

    return { destroyRegistry };

    function registerElements(): RegisteredRenderer<Element> {
        return registerRenderer<Element>({
            prototype: Element.prototype,
            children: elementChildren,
            // Not `parentNode`: a node moved into a fragment has left the scene,
            // and is skipped like any other detached node.
            parent: (node) => node.parentElement,
            describe: (node) => (node.id ? `<${node.localName} id="${node.id}">` : `<${node.localName}>`),
            flushChanges: watchElementTree,
        });
    }

    /**
     * Makes sure `updateView` and `refreshView` hear about every change to the
     * element tree under `node`, and catches up on the changes made since the
     * last call. The registration's `flushChanges`: called at the start of
     * every `updateView` and `refreshView`, on the node it starts from.
     *
     * The DOM has too many ways to change a tree to wrap them all (`append`,
     * `before`, `replaceChildren`, `innerHTML` and more), and wrapping any of
     * them would change them for every script on the page. Instead one
     * `MutationObserver` watches the subtree of each node a call starts from,
     * and its records are taken here synchronously, with `takeRecords`, so a
     * change made just before a call is seen by it. The observer's callback
     * handles records that arrive between calls the same way.
     *
     * An element that leaves a watched subtree is watched on its own from then
     * on, so a change made inside it while it is detached still clears its
     * method lists before it is attached and walked again. Until its removal is
     * processed, the DOM's transient observers cover it: the standard says a
     * removed node stays observed by its old ancestors' observers until their
     * records are delivered, and browsers do so. happy-dom does not, so there a
     * change made to a removed element before the next call or microtask can
     * be missed.
     */
    function watchElementTree(node: Element): void {
        if (observer !== undefined) processRecords(observer.takeRecords());
        if (!watched.has(node)) watch(node);
    }

    function watch(node: Node): void {
        observer ??= new MutationObserver(processRecords);
        watched.add(node);
        // Element children only: text changes need no records, and the JSX `text`
        // attribute writes a text node's `data`, which queues none.
        observer.observe(node, { childList: true, subtree: true });
    }

    /**
     * Clears the method lists above every element whose element children
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
                renderer?.invalidate(record.target as Element);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ELEMENT_NODE = 1;

const NO_CHILDREN: readonly Element[] = [];

/**
 * An element's element children, as an array, for rebuilding a method list.
 * Not `children`: indexing that live collection made rebuilds twice as slow
 * in Chrome as walking siblings into an array, and a leaf, most elements,
 * shares one empty array (the `html-refresh-view` benchmark, `churn`).
 */
function elementChildren(node: Element): readonly Element[] {
    let child = node.firstElementChild;
    if (child === null) return NO_CHILDREN;
    const children: Element[] = [];
    for (; child !== null; child = child.nextElementSibling) children.push(child);
    return children;
}

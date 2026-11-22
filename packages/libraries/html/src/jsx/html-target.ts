import { attributesOf, type JsxTarget } from '@mvtjs/utils/jsx';
import { assert } from '@mvtjs/utils';
import { destroyElement, onDestroyed } from '../element-mixin';
import { selectPendingValue } from './html-elements';
import { hasOwnedText } from './owned-text';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The style rule that makes `<mvt-group>` elements, which group JSX
 * fragments, `<List>` and `<Switch>`, leave their children's layout alone.
 * Added to a document's head the first time a group is made in it. A shadow
 * root does not see it, so a view rendered into one must adopt it there too.
 *
 * The `:not([hidden])` is needed: this is author CSS, which would otherwise
 * beat the browser's own `[hidden] { display: none }`.
 */
export const MVT_GROUP_CSS = 'mvt-group:not([hidden]){display:contents}';

/**
 * A resource that an element's `owns` attribute may list. The JSX target's
 * `release` frees each kind its own way:
 *
 * - Anything with an `abort()` method, such as an `AbortController`, is
 *   aborted. Aborting a controller removes the listeners that were added
 *   with its `signal`, which is handy for `window` listeners.
 * - Anything with a `close()` method, such as an `ImageBitmap` or a
 *   `BroadcastChannel`, is closed.
 * - Anything with a `destroy()` method, such as a Pixi application that the
 *   element shows, is destroyed.
 */
export type OwnedResource =
    | { readonly abort: () => void }
    | { readonly close: () => void }
    | { readonly destroy: () => void };

// ---------------------------------------------------------------------------
// JSX target
// ---------------------------------------------------------------------------

/**
 * The DOM, as the JSX base needs it. Nodes are `Element`s, whose methods
 * `updateView` and `refreshView` call.
 */
export const htmlTarget: JsxTarget<Element, OwnedResource> = {
    name: '@mvtjs/html',

    // A custom tag rather than a `<div>` with an inline style: groups are
    // recognisable in the devtools, and styled by one rule.
    createGroup: () => {
        if (!styledDocuments.has(document)) addGroupStyle(document);
        return document.createElement('mvt-group');
    },
    append: (parent, child) => {
        if (DEV) {
            assert(!hasOwnedText(parent), () => `[@mvtjs/html] <${parent.localName}> has text, so it cannot also have element children; put the text in a child element`);
        }
        parent.appendChild(child);
        // A fixed `value` on a `<select>` is written before its options exist
        if (parent instanceof HTMLSelectElement) selectPendingValue(parent, child);
    },
    replace: (parent, current, next) => {
        parent.replaceChild(next, current);
    },
    detachTail: (parent, count) => {
        for (let i = 0; i < count; i++) parent.lastElementChild?.remove();
    },

    // The `hidden` attribute: it means hidden to assistive technology too, and
    // needs no style. Author CSS that sets `display` on the same element
    // overrides it, as it always does. Written every frame, but compared with
    // the element first, because `<List>` shows and hides its slots directly:
    // an on-change write would not notice, and would leave a slot shown that
    // its own `visible` binding hides.
    visible: attributesOf<Element>().everyFrame((e, v: boolean) => {
        if (e.hasAttribute('hidden') === v) e.toggleAttribute('hidden', !v);
    }),

    destroy: destroyElement,
    onDestroyed,
    release: (resource) => {
        if ('abort' in resource) resource.abort();
        else if ('close' in resource) resource.close();
        else resource.destroy();
    },

    listen: (node, eventName, handler) => {
        node.addEventListener(eventName, handler as EventListener);
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Documents that have the group style rule. */
const styledDocuments = new WeakSet<Document>();

function addGroupStyle(doc: Document): void {
    styledDocuments.add(doc);
    const style = doc.createElement('style');
    style.dataset.mvtGroup = '';
    style.textContent = MVT_GROUP_CSS;
    (doc.head ?? doc.documentElement).append(style);
}

// Vite replaces `import.meta.env.DEV` at build time; plain Node has no
// `import.meta.env`, so it is read defensively.
const DEV = import.meta.env?.DEV === true;

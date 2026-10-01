import { attributesOf, type JsxTarget } from '#mvt-utils/jsx';
import { destroyElement, onDestroyed, refreshScene } from '../element-mixin';
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

// ---------------------------------------------------------------------------
// JSX target
// ---------------------------------------------------------------------------

/**
 * The DOM, as the JSX base needs it. Nodes are `Element`s, whose methods the
 * html-mvt scene passes call.
 */
export const htmlTarget: JsxTarget<Element> = {
    name: 'html-mvt/jsx',

    // A custom tag rather than a `<div>` with an inline style: groups are
    // recognisable in the devtools, and styled by one rule.
    createGroup: () => {
        if (!styledDocuments.has(document)) addGroupStyle(document);
        return document.createElement('mvt-group');
    },
    append: (parent, child) => {
        if (DEV && hasOwnedText(parent)) {
            throw new Error(`[html-mvt/jsx] <${parent.localName}> has text, so it cannot also have element children; put the text in a child element`);
        }
        parent.appendChild(child);
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

    listen: (node, eventName, handler) => {
        node.addEventListener(eventName, handler as EventListener);
    },

    refreshScene,
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

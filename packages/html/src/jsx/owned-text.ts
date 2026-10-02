import { assert } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The `text` attribute's write: sets the text of a `Text` node the element
 * owns, made on the first write. Writing the node's `data`, rather than the
 * element's `textContent`, keeps the node, so a change of text is cheaper
 * and queues no mutation record for the scene passes to process.
 *
 * An element with `text` holds that text and no elements: JSX has no text
 * children (proposal 022 section 5.4), so text and elements never mix. Dev
 * builds throw if they would.
 */
export function writeText(el: Element, value: string | number): void {
    const text = String(value);
    const node = ownedText.get(el);
    if (node !== undefined) {
        node.data = text;
        return;
    }
    if (DEV) {
        assert(!el.firstElementChild, () => `[@mvtjs/html/jsx] <${el.localName}> has element children, so it cannot also have text; put the text in a child element`);
    }
    const created = el.ownerDocument.createTextNode(text);
    ownedText.set(el, created);
    el.appendChild(created);
}

/** Whether `el` has text written by the `text` attribute. */
export function hasOwnedText(el: Element): boolean {
    return ownedText.has(el);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ownedText = new WeakMap<Element, Text>();

// Vite replaces `import.meta.env.DEV` at build time; plain Node has no
// `import.meta.env`, so it is read defensively.
const DEV = import.meta.env?.DEV === true;
